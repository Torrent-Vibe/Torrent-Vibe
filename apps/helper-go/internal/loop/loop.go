package loop

import (
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/events"
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

var completeState = regexp.MustCompile(`^(uploading|pausedUP|stoppedUP|stalledUP|queuedUP|forcedUP|checkingUP)$`)

func MikanTag(subscriptionID string) string {
	return "tv-mikan:" + subscriptionID
}

type RSSResult struct {
	Body       string
	StatusCode int
	Duration   time.Duration
}

type Deps struct {
	Store            *store.Store
	FetchRSS         func(url string) (RSSResult, error)
	FetchTorrent     func(url string) ([]byte, error)
	QB               qb.Client
	LibraryRoot      string
	Category         string
	ResolveTitle     func(replica protocol.Replica, item mikan.RssEpisode, parsed mikan.ParsedTitle) mikan.ParsedTitle
	ResolveSeason    func(ident mikan.Identity) *int
	VariantPrefer    []mikan.Language
	Events           events.Recorder
	OnReplicaChecked func(replicaKey string, at time.Time, err error)
}

func (d Deps) emit(e events.Event) {
	if d.Events == nil {
		return
	}
	d.Events.Emit(e)
}

func (d Deps) checkedReplica(key string, err error) {
	if d.OnReplicaChecked == nil {
		return
	}
	d.OnReplicaChecked(key, time.Now(), err)
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
	start := time.Now()
	replicas, err := deps.Store.LoadReplicas()
	if err != nil {
		return err
	}
	deps.emit(events.Event{Level: "info", Kind: "tick.start", Fields: map[string]any{"replicaCount": len(replicas)}})
	maps, err := deps.Store.LoadEpisodes()
	if err != nil {
		return err
	}
	torrents, err := deps.QB.ListTorrents()
	if err != nil {
		return err
	}
	present := hashesOf(torrents)
	addedCount := 0
	for _, replica := range replicas {
		key := store.EpisodeKey(replica.BangumiID, replica.SubgroupID)
		before := len(maps[key])
		incoming := []mikan.RssEpisode{}
		if deps.FetchRSS != nil && replica.RSSURL != "" {
			var fetchErr error
			incoming, fetchErr = fetchRSSEpisodes(deps, replica)
			deps.checkedReplica(key, fetchErr)
		}
		next, err := ingestEpisodes(deps, replica, incoming, maps[key], present)
		if err != nil {
			return err
		}
		for _, episode := range next[before:] {
			if episode.State == protocol.StateAdded {
				addedCount++
			}
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
	err = deps.Store.SaveEpisodes(maps)
	deps.emit(events.Event{Level: "info", Kind: "tick.done", Fields: map[string]any{
		"replicaCount": len(replicas), "addedCount": addedCount, "durationMs": time.Since(start).Milliseconds(),
	}})
	return err
}

func fetchRSSEpisodes(deps Deps, replica protocol.Replica) ([]mikan.RssEpisode, error) {
	result, err := deps.FetchRSS(replica.RSSURL)
	if err != nil {
		deps.emit(events.Event{
			Level: "warn", Kind: "rss.fetch",
			ReplicaID: replica.ID, BangumiID: replica.BangumiID, SubgroupID: replica.SubgroupID,
			Fields: map[string]any{
				"url": replica.RSSURL, "httpStatus": result.StatusCode, "itemCount": 0,
				"durationMs": result.Duration.Milliseconds(), "error": err.Error(),
			},
		})
		return nil, err
	}
	incoming := mikan.ParseBangumiRSS(result.Body, rssBase(replica.RSSURL))
	deps.emit(events.Event{
		Level: "info", Kind: "rss.fetch",
		ReplicaID: replica.ID, BangumiID: replica.BangumiID, SubgroupID: replica.SubgroupID,
		Fields: map[string]any{
			"url": replica.RSSURL, "httpStatus": result.StatusCode, "itemCount": len(incoming),
			"durationMs": result.Duration.Milliseconds(),
		},
	})
	return incoming, nil
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
				deps.emit(events.Event{
					Level: "error", Kind: "qb.rename",
					ReplicaID: replica.ID, BangumiID: replica.BangumiID, SubgroupID: replica.SubgroupID, EpisodeID: episode.EpisodeID,
					Fields: map[string]any{"from": plan.From, "to": plan.To, "error": err.Error()},
				})
				break
			}
			deps.emit(events.Event{
				Level: "info", Kind: "qb.rename",
				ReplicaID: replica.ID, BangumiID: replica.BangumiID, SubgroupID: replica.SubgroupID, EpisodeID: episode.EpisodeID,
				Fields: map[string]any{"from": plan.From, "to": plan.To},
			})
		}
		if failed {
			continue
		}
		episode.State = protocol.StateDone
		episode.LastError = ""
		next[i] = episode
		deps.emit(events.Event{
			Level: "info", Kind: "episode.done",
			ReplicaID: replica.ID, BangumiID: replica.BangumiID, SubgroupID: replica.SubgroupID, EpisodeID: episode.EpisodeID,
			Fields: map[string]any{"hash": episode.Infohash},
		})
	}
	return next, nil
}

func hashesOf(torrents []qb.Torrent) map[string]struct{} {
	out := make(map[string]struct{}, len(torrents))
	for _, item := range torrents {
		out[strings.ToLower(item.Hash)] = struct{}{}
	}
	return out
}

func isComplete(torrent qb.Torrent) bool {
	if torrent.Progress >= 1 {
		return true
	}
	return completeState.MatchString(torrent.State)
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
