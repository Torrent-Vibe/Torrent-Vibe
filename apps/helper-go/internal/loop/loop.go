package loop

import (
	"errors"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/qb"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/rename"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

const (
	BangumiCategory       = "Bangumi"
	DefaultPollInterval   = 10 * time.Minute
	DefaultPollIntervalMs = 600000
)

func MikanTag(subscriptionID string) string {
	return "tv-mikan:" + subscriptionID
}

type Deps struct {
	Store         *store.Store
	FetchRSS      func(url string) (string, error)
	FetchTorrent  func(url string) ([]byte, error)
	QB            qb.Client
	LibraryRoot   string
	Category      string
	ResolveTitle  func(replica protocol.Replica, item mikan.RssEpisode, parsed mikan.ParsedTitle) mikan.ParsedTitle
	ResolveSeason func(ident mikan.Identity) *int
	VariantPrefer []mikan.Language
	AfterTick     func(torrents []qb.Torrent) error
}

var workMu sync.Map

func queue(store *store.Store) *sync.Mutex {
	v, _ := workMu.LoadOrStore(store, &sync.Mutex{})
	return v.(*sync.Mutex)
}

func Tick(deps Deps) error {
	mu := queue(deps.Store)
	mu.Lock()
	defer mu.Unlock()
	return runTick(deps)
}

func Backfill(deps Deps, bangumiID, subgroupID string, items []mikan.RssEpisode) ([]store.Episode, error) {
	mu := queue(deps.Store)
	mu.Lock()
	defer mu.Unlock()
	return runBackfill(deps, bangumiID, subgroupID, items)
}

func Start(deps Deps, interval time.Duration) (stop func()) {
	if interval <= 0 {
		interval = DefaultPollInterval
	}
	done := make(chan struct{})
	go func() {
		_ = Tick(deps)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				_ = Tick(deps)
			}
		}
	}()
	return func() { close(done) }
}

func categoryOf(deps Deps) string {
	if deps.Category == "" {
		return BangumiCategory
	}
	return deps.Category
}

func runTick(deps Deps) error {
	replicas, err := deps.Store.LoadReplicas()
	if err != nil {
		return err
	}
	maps, err := deps.Store.LoadEpisodes()
	if err != nil {
		return err
	}
	torrents, err := deps.QB.ListTorrents()
	if err != nil {
		return err
	}
	present := hashesOf(torrents)
	for _, replica := range replicas {
		key := store.EpisodeKey(replica.BangumiID, replica.SubgroupID)
		incoming := []mikan.RssEpisode{}
		if deps.FetchRSS != nil && replica.RSSURL != "" {
			if raw, err := deps.FetchRSS(replica.RSSURL); err == nil {
				incoming = mikan.ParseBangumiRSS(raw, rssBase(replica.RSSURL))
			}
		}
		next, err := ingestEpisodes(deps, replica, incoming, maps[key], present)
		if err != nil {
			return err
		}
		maps[key] = next
	}
	for key, episodes := range maps {
		replica, ok := findReplica(replicas, key)
		if !ok {
			replica = contextFromMap(key, episodes)
		}
		next, err := syncCompleted(deps, replica, key, maps, episodes, torrents)
		if err != nil {
			return err
		}
		maps[key] = next
	}
	if err := deps.Store.SaveEpisodes(maps); err != nil {
		return err
	}
	if deps.AfterTick != nil {
		return deps.AfterTick(torrents)
	}
	return nil
}

func runBackfill(deps Deps, bangumiID, subgroupID string, items []mikan.RssEpisode) ([]store.Episode, error) {
	replicas, err := deps.Store.LoadReplicas()
	if err != nil {
		return nil, err
	}
	replica, ok := findReplica(replicas, store.EpisodeKey(bangumiID, subgroupID))
	if !ok {
		replica = syntheticReplica(bangumiID, subgroupID, items)
	}
	key := store.EpisodeKey(bangumiID, subgroupID)
	maps, err := deps.Store.LoadEpisodes()
	if err != nil {
		return nil, err
	}
	torrents, err := deps.QB.ListTorrents()
	if err != nil {
		return nil, err
	}
	next, err := ingestEpisodes(deps, replica, items, maps[key], hashesOf(torrents))
	if err != nil {
		return nil, err
	}
	next, err = syncCompleted(deps, replica, key, maps, next, torrents)
	if err != nil {
		return nil, err
	}
	maps[key] = next
	if err := deps.Store.SaveEpisodes(maps); err != nil {
		return nil, err
	}
	return next, nil
}

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
		if candidate.manual {
			var season *int
			if candidate.season != 0 || candidate.kind == mikan.KindSpecial {
				season = intPtr(candidate.season)
			}
			record := stampIdentity(baseEpisode(candidate.item, candidate.infohash, season, nil), candidate)
			record.State = protocol.StateNeedsManual
			episodes = append(episodes, record)
			remember(byID, byHash, record)
			continue
		}
		if candidate.skip {
			record := stampIdentity(baseEpisode(candidate.item, "", intPtr(candidate.season), intPtr(candidate.episode)), candidate)
			record.State = protocol.StateSkipped
			record.LastError = candidate.reason
			episodes = append(episodes, record)
			remember(byID, byHash, record)
			continue
		}
		raw, err := fetchTorrent(deps, candidate.item.TorrentURL)
		if err != nil {
			record := stampIdentity(baseEpisode(candidate.item, candidate.infohash, intPtr(candidate.season), intPtr(candidate.episode)), candidate)
			record.State = protocol.StateFailed
			record.LastError = err.Error()
			episodes = append(episodes, record)
			remember(byID, byHash, record)
			continue
		}
		show := showTitle(candidate.series, replica.Title)
		hash, err := deps.QB.AddTorrent(qb.AddRequest{
			Torrent:  raw,
			URLs:     candidate.item.TorrentURL,
			SavePath: rename.FormatSavePath(deps.LibraryRoot, show, candidate.season),
			Category: categoryOf(deps),
			Tags:     MikanTag(replica.ID),
			Rename:   rename.FormatEpisodeName(show, candidate.season, candidate.episode),
		})
		if err != nil {
			record := stampIdentity(baseEpisode(candidate.item, candidate.infohash, intPtr(candidate.season), intPtr(candidate.episode)), candidate)
			record.State = protocol.StateFailed
			record.LastError = err.Error()
			episodes = append(episodes, record)
			remember(byID, byHash, record)
			continue
		}
		hash = strings.ToLower(hash)
		record := stampIdentity(baseEpisode(candidate.item, hash, intPtr(candidate.season), intPtr(candidate.episode)), candidate)
		record.State = protocol.StateAdded
		episodes = append(episodes, record)
		remember(byID, byHash, record)
		presentHashes[hash] = struct{}{}
	}
	return episodes, nil
}

func syncCompleted(
	deps Deps,
	replica protocol.Replica,
	key string,
	maps map[string][]store.Episode,
	episodes []store.Episode,
	torrents []qb.Torrent,
) ([]store.Episode, error) {
	next := append([]store.Episode(nil), episodes...)
	for i := range next {
		episode := next[i]
		if episode.State == protocol.StateNeedsManual || episode.State == protocol.StateDone || episode.State == protocol.StateSkipped || episode.Episode == nil || episode.Season == nil {
			continue
		}
		var torrent *qb.Torrent
		for j := range torrents {
			if episode.Infohash != "" && strings.EqualFold(torrents[j].Hash, episode.Infohash) {
				torrent = &torrents[j]
				break
			}
		}
		if torrent == nil {
			continue
		}
		if !isComplete(*torrent) {
			if episode.State == protocol.StateAdded || episode.State == protocol.StatePending {
				episode.State = protocol.StateDownloading
				next[i] = episode
			}
			continue
		}
		episode.State = protocol.StateRenaming
		episode.LastError = ""
		next[i] = episode
		maps[key] = next
		_ = deps.Store.SaveEpisodes(maps)
		files, err := deps.QB.ListFiles(torrent.Hash)
		if err != nil {
			episode.State = protocol.StateFailed
			episode.LastError = err.Error()
			next[i] = episode
			continue
		}
		if len(files) == 0 {
			continue
		}
		plans := rename.PlanEpisodeRenames(rename.FormatEpisodeName(showTitle(episode.Series, replica.Title), *episode.Season, *episode.Episode), files)
		failed := false
		for _, plan := range plans {
			if err := deps.QB.RenameFile(torrent.Hash, plan.From, plan.To); err != nil {
				episode.State = protocol.StateFailed
				episode.LastError = err.Error()
				next[i] = episode
				failed = true
				break
			}
		}
		if failed {
			continue
		}
		episode.State = protocol.StateDone
		episode.LastError = ""
		next[i] = episode
	}
	return next, nil
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

func hashesOf(torrents []qb.Torrent) map[string]struct{} {
	out := make(map[string]struct{}, len(torrents))
	for _, item := range torrents {
		out[strings.ToLower(item.Hash)] = struct{}{}
	}
	return out
}

func isComplete(torrent qb.Torrent) bool {
	return qb.IsComplete(torrent)
}

func findReplica(replicas []protocol.Replica, key string) (protocol.Replica, bool) {
	for _, replica := range replicas {
		if store.EpisodeKey(replica.BangumiID, replica.SubgroupID) == key {
			return replica, true
		}
	}
	return protocol.Replica{}, false
}

func syntheticReplica(bangumiID, subgroupID string, items []mikan.RssEpisode) protocol.Replica {
	eps := make([]store.Episode, 0, len(items))
	for _, item := range items {
		eps = append(eps, store.Episode{Title: item.Title})
	}
	return contextFromMap(store.EpisodeKey(bangumiID, subgroupID), eps)
}

func contextFromMap(key string, episodes []store.Episode) protocol.Replica {
	bangumiID, subgroupID := key, ""
	if i := strings.Index(key, ":"); i >= 0 {
		bangumiID, subgroupID = key[:i], key[i+1:]
	}
	title := bangumiID
	for _, item := range episodes {
		parsed := mikan.ParseMikanTitle(item.Title)
		if parsed.Title != "" {
			title = parsed.Title
			break
		}
	}
	return protocol.Replica{
		ID:         key,
		BangumiID:  bangumiID,
		Title:      title,
		SubgroupID: subgroupID,
	}
}

func rssBase(rssURL string) string {
	parsed, err := url.Parse(rssURL)
	if err != nil {
		return rssURL
	}
	return parsed.Scheme + "://" + parsed.Host
}

func identifySource(replica protocol.Replica) string {
	if replica.Title == "" || replica.Title == replica.BangumiID {
		return ""
	}
	return replica.Title
}

func showTitle(series, fallback string) string {
	if series != "" {
		return series
	}
	return fallback
}

func stampIdentity(record store.Episode, candidate *variantCandidate) store.Episode {
	record.Series = candidate.series
	if candidate.kind != "" {
		record.Kind = string(candidate.kind)
	}
	return record
}

func intPtr(v int) *int {
	return &v
}
