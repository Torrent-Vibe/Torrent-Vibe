package loop

import (
	"errors"
	"strings"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/events"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/qb"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/rename"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

func ingestEpisodes(
	deps Deps,
	replica protocol.Replica,
	incoming []mikan.RssEpisode,
	current []store.Episode,
	presentHashes map[string]struct{},
) ([]store.Episode, error) {
	episodes := append([]store.Episode(nil), current...)
	byID := map[string]struct{}{}
	byHash := map[string]struct{}{}
	for _, item := range episodes {
		byID[item.EpisodeID] = struct{}{}
		if item.Infohash != "" {
			byHash[strings.ToLower(item.Infohash)] = struct{}{}
		}
	}
	var candidates []*variantCandidate
	for _, item := range incoming {
		if _, ok := byID[item.EpisodeID]; ok {
			continue
		}
		infohash := qb.ExtractTorrentInfohash(item.TorrentURL)
		if infohash != "" {
			if _, ok := byHash[infohash]; ok {
				continue
			}
			if _, ok := presentHashes[infohash]; ok {
				continue
			}
		}
		ident := mikan.Identify(identifySource(replica), item.Title)
		if deps.ResolveSeason != nil && ident.SeasonAmbiguous && ident.Season == nil && ident.Kind == mikan.KindEpisode {
			if resolved := deps.ResolveSeason(ident); resolved != nil {
				ident.Season = resolved
				ident.SeasonAmbiguous = false
			}
		}
		if ident.Episode == nil && deps.ResolveTitle != nil {
			parsed := mikan.ParsedTitle{Title: ident.Series, Season: ident.Season, Episode: ident.Episode}
			parsed = deps.ResolveTitle(replica, item, parsed)
			ident.Episode = parsed.Episode
		}
		next := &variantCandidate{item: item, infohash: infohash, series: ident.Series, kind: ident.Kind}
		if ident.Kind == mikan.KindCollection || ident.Episode == nil {
			if ident.Season != nil {
				next.season = *ident.Season
			}
			next.manual = true
			if ident.Kind == mikan.KindCollection {
				next.manualReason = "collection"
			} else {
				next.manualReason = "no-episode-number"
			}
			candidates = append(candidates, next)
			continue
		}
		season := 1
		if ident.Kind == mikan.KindSpecial {
			season = 0
		} else if ident.Season != nil {
			season = *ident.Season
		}
		res, okRes := mikan.ClassifyResolution(item.Title)
		next.season = season
		next.episode = *ident.Episode
		next.lang = mikan.ClassifyLanguage(item.Title)
		next.res = res
		next.okRes = okRes
		candidates = append(candidates, next)
	}
	applyVariantPick(candidates, episodes, deps.VariantPrefer)
	for _, candidate := range candidates {
		emitFor := func(level, kind string, fields map[string]any) {
			deps.emit(events.Event{
				Level: level, Kind: kind, Fields: fields,
				ReplicaID: replica.ID, BangumiID: replica.BangumiID, SubgroupID: replica.SubgroupID, EpisodeID: candidate.item.EpisodeID,
			})
		}
		if candidate.manual {
			var season *int
			if candidate.season != 0 || candidate.kind == mikan.KindSpecial {
				season = intPtr(candidate.season)
			}
			record := stampIdentity(baseEpisode(candidate.item, candidate.infohash, season, nil), candidate)
			record.State = protocol.StateNeedsManual
			episodes = append(episodes, record)
			remember(byID, byHash, record)
			emitFor("info", "episode.manual", map[string]any{"reason": candidate.manualReason})
			continue
		}
		if candidate.skip {
			record := stampIdentity(baseEpisode(candidate.item, "", intPtr(candidate.season), intPtr(candidate.episode)), candidate)
			record.State = protocol.StateSkipped
			record.LastError = candidate.reason
			episodes = append(episodes, record)
			remember(byID, byHash, record)
			emitFor("info", "episode.skip", map[string]any{"reason": candidate.reason, "rival": candidate.rival})
			continue
		}
		raw, err := fetchTorrent(deps, candidate.item.TorrentURL)
		if err != nil {
			record := stampIdentity(baseEpisode(candidate.item, candidate.infohash, intPtr(candidate.season), intPtr(candidate.episode)), candidate)
			record.State = protocol.StateFailed
			record.LastError = err.Error()
			episodes = append(episodes, record)
			remember(byID, byHash, record)
			emitFor("error", "torrent.fetch", map[string]any{"url": candidate.item.TorrentURL, "error": err.Error()})
			continue
		}
		show := showTitle(candidate.series, replica.Title)
		savePath := rename.FormatSavePath(deps.LibraryRoot, show, candidate.season)
		category := categoryOf(deps)
		tags := MikanTag(replica.ID)
		hash, err := deps.QB.AddTorrent(qb.AddRequest{
			Torrent:  raw,
			URLs:     candidate.item.TorrentURL,
			SavePath: savePath,
			Category: category,
			Tags:     tags,
			Rename:   rename.FormatEpisodeName(show, candidate.season, candidate.episode),
		})
		if err != nil {
			record := stampIdentity(baseEpisode(candidate.item, candidate.infohash, intPtr(candidate.season), intPtr(candidate.episode)), candidate)
			record.State = protocol.StateFailed
			record.LastError = err.Error()
			episodes = append(episodes, record)
			remember(byID, byHash, record)
			emitFor("error", "qb.add", map[string]any{"error": err.Error()})
			continue
		}
		hash = strings.ToLower(hash)
		record := stampIdentity(baseEpisode(candidate.item, hash, intPtr(candidate.season), intPtr(candidate.episode)), candidate)
		record.State = protocol.StateAdded
		episodes = append(episodes, record)
		remember(byID, byHash, record)
		presentHashes[hash] = struct{}{}
		emitFor("info", "qb.add", map[string]any{"hash": hash, "savePath": savePath, "category": category, "tags": tags})
	}
	return episodes, nil
}

func baseEpisode(item mikan.RssEpisode, infohash string, season, episode *int) store.Episode {
	record := store.Episode{
		EpisodeID: item.EpisodeID,
		Title:     item.Title,
		Season:    season,
		Episode:   episode,
		State:     protocol.StatePending,
	}
	if infohash != "" {
		record.Infohash = infohash
	}
	return record
}

func remember(byID, byHash map[string]struct{}, record store.Episode) {
	byID[record.EpisodeID] = struct{}{}
	if record.Infohash != "" {
		byHash[strings.ToLower(record.Infohash)] = struct{}{}
	}
}

func fetchTorrent(deps Deps, rawURL string) ([]byte, error) {
	if deps.FetchTorrent == nil {
		return nil, errors.New("torrent fetch is not configured")
	}
	return deps.FetchTorrent(rawURL)
}
