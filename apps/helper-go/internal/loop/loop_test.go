package loop_test

import (
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/loop"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/qb"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

const (
	mapKey    = "3141:583"
	hash28    = "a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c"
	hash27    = "238eeb554bcd07b86335c8f8d402a69c11b15789"
	hashPack  = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	hashS2    = "cccccccccccccccccccccccccccccccccccccccc"
	packTitle = "[喵萌奶茶屋&LoliHouse] 葬送的芙莉莲 / Sousou no Frieren [01-28 修正合集][WebRip 1080p HEVC-10bit AAC][简繁日内封字幕][Fin]"
)

func replica(id, title string) protocol.Replica {
	if id == "" {
		id = "sub-1"
	}
	if title == "" {
		title = "葬送的芙莉莲"
	}
	return protocol.Replica{
		ID: id, BangumiID: "3141", Title: title, SubgroupID: "583",
		SubgroupName: "ANi", RSSURL: "https://mikan.example/RSS/Bangumi?bangumiId=3141&subgroupid=583",
	}
}

func rssXML(title, hash string) string {
	return `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><item><title>` + title + `</title><link>https://mikan.example/Home/Episode/` + hash + `</link><enclosure type="application/x-bittorrent" url="https://mikan.example/Download/20240322/` + hash + `.torrent" /></item></channel></rss>`
}

func rssItem(title, hash string) mikan.RssEpisode {
	return mikan.RssEpisode{
		EpisodeID:  hash,
		Title:      title,
		TorrentURL: "https://mikan.example/Download/20240322/" + hash + ".torrent",
	}
}

func seed(t *testing.T, replicas []protocol.Replica, episodes map[string][]store.Episode) *store.Store {
	t.Helper()
	s := store.New(t.TempDir())
	if err := s.SaveReplicas(replicas); err != nil {
		t.Fatal(err)
	}
	if episodes != nil {
		if err := s.SaveEpisodes(episodes); err != nil {
			t.Fatal(err)
		}
	}
	return s
}

func episodesOf(t *testing.T, s *store.Store) []store.Episode {
	t.Helper()
	maps, err := s.LoadEpisodes()
	if err != nil {
		t.Fatal(err)
	}
	return maps[mapKey]
}

type fakeQB struct {
	mu      sync.Mutex
	torrents []qb.Torrent
	files   map[string][]qb.File
	added   []qb.AddRequest
	renames []struct{ Hash, From, To string }
	addErr  error
	renErr  error
	onRename func(*fakeQB)
}

func newFake(initial ...qb.Torrent) *fakeQB {
	cp := append([]qb.Torrent(nil), initial...)
	return &fakeQB{torrents: cp, files: map[string][]qb.File{}}
}

func (f *fakeQB) ListTorrents() ([]qb.Torrent, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]qb.Torrent, len(f.torrents))
	copy(out, f.torrents)
	return out, nil
}

func (f *fakeQB) AddTorrent(req qb.AddRequest) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.addErr != nil {
		return "", f.addErr
	}
	f.added = append(f.added, req)
	hash := qb.ExtractTorrentInfohash(req.URLs)
	if hash == "" {
		hash = "hash-x"
	}
	f.torrents = append(f.torrents, qb.Torrent{
		Hash: hash, Name: req.Rename, State: "downloading",
		Category: req.Category, Tags: req.Tags,
	})
	return hash, nil
}

func (f *fakeQB) ListFiles(hash string) ([]qb.File, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]qb.File(nil), f.files[strings.ToLower(hash)]...), nil
}

func (f *fakeQB) RenameFile(hash, oldPath, newPath string) error {
	if f.onRename != nil {
		f.onRename(f)
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.renErr != nil {
		return f.renErr
	}
	f.renames = append(f.renames, struct{ Hash, From, To string }{strings.ToLower(hash), oldPath, newPath})
	return nil
}

func (f *fakeQB) setFiles(hash string, files []qb.File) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.files[strings.ToLower(hash)] = files
}

func (f *fakeQB) complete(hash string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for i := range f.torrents {
		if strings.EqualFold(f.torrents[i].Hash, hash) {
			f.torrents[i].Progress = 1
			f.torrents[i].State = "uploading"
		}
	}
}

func TestAddNewRSSEpisode(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	if err := loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library",
		FetchRSS: func(string) (string, error) { return rssXML("[ANi] 葬送的芙莉莲 - 28 [1080P]", hash28), nil },
	}); err != nil {
		t.Fatal(err)
	}
	if len(qbFake.added) != 1 || qbFake.added[0].SavePath != "/library/葬送的芙莉莲/Season 01" ||
		qbFake.added[0].Rename != "葬送的芙莉莲 - S01E28" || qbFake.added[0].Category != "Bangumi" ||
		qbFake.added[0].Tags != "tv-mikan:sub-1" {
		t.Fatalf("%+v", qbFake.added)
	}
	got := episodesOf(t, s)
	if len(got) != 1 || got[0].State != protocol.StateAdded || got[0].Infohash != hash28 {
		t.Fatalf("%+v", got)
	}
}

func TestSkipExistingEpisodeID(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	deps := loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library",
		FetchRSS: func(string) (string, error) { return rssXML("[ANi] 葬送的芙莉莲 - 28 [1080P]", hash28), nil },
	}
	_ = loop.Tick(deps)
	_ = loop.Tick(deps)
	if len(qbFake.added) != 1 || len(episodesOf(t, s)) != 1 {
		t.Fatal("dedupe failed")
	}
}

func TestSkipPresentQbHash(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake(qb.Torrent{Hash: hash28, Name: "manual", Progress: 1, State: "uploading"})
	_ = loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library",
		FetchRSS: func(string) (string, error) { return rssXML("[ANi] 葬送的芙莉莲 - 28 [1080P]", hash28), nil },
	})
	if len(qbFake.added) != 0 || len(episodesOf(t, s)) != 0 {
		t.Fatal("should skip in-qbit hash")
	}
}

func TestNeedsManualCollection(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	_ = loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library",
		FetchRSS: func(string) (string, error) { return rssXML(packTitle, hashPack), nil },
	})
	got := episodesOf(t, s)
	if len(qbFake.added) != 0 || len(got) != 1 || got[0].State != protocol.StateNeedsManual {
		t.Fatalf("%+v %+v", qbFake.added, got)
	}
}

func TestParsedSeason(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("sub-2", "Example Show")}, nil)
	qbFake := newFake()
	_ = loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library",
		FetchRSS: func(string) (string, error) {
			return rssXML("[LoliHouse] Example Show S02E07 [WebRip 1080p]", hashS2), nil
		},
	})
	if qbFake.added[0].SavePath != "/library/Example Show/Season 02" || qbFake.added[0].Rename != "Example Show - S02E07" {
		t.Fatalf("%+v", qbFake.added)
	}
}

func TestRenameOnCompleteSkipsSample(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	qbFake.setFiles(hash28, []qb.File{
		{Name: "[ANi] 葬送的芙莉莲 - 28 [1080P].mp4", Size: 700_000_000},
		{Name: "[ANi] 葬送的芙莉莲 - 28 [1080P].cht.ass", Size: 40_000},
		{Name: "Sample/[ANi] 葬送的芙莉莲 - 28 Sample.mp4", Size: 12_000_000},
	})
	deps := loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library",
		FetchRSS: func(string) (string, error) { return rssXML("[ANi] 葬送的芙莉莲 - 28 [1080P]", hash28), nil },
	}
	_ = loop.Tick(deps)
	qbFake.complete(hash28)
	_ = loop.Tick(deps)
	if len(qbFake.renames) != 2 || qbFake.renames[0].To != "葬送的芙莉莲 - S01E28.mp4" {
		t.Fatalf("%+v", qbFake.renames)
	}
	if episodesOf(t, s)[0].State != protocol.StateDone {
		t.Fatal(episodesOf(t, s)[0].State)
	}
}

func TestRenameFailRetries(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	qbFake.setFiles(hash28, []qb.File{{Name: "[ANi] 葬送的芙莉莲 - 28 [1080P].mp4", Size: 700_000_000}})
	deps := loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library",
		FetchRSS: func(string) (string, error) { return rssXML("[ANi] 葬送的芙莉莲 - 28 [1080P]", hash28), nil },
	}
	_ = loop.Tick(deps)
	qbFake.complete(hash28)
	qbFake.renErr = errors.New("rename failed")
	_ = loop.Tick(deps)
	if episodesOf(t, s)[0].State != protocol.StateFailed {
		t.Fatal(episodesOf(t, s)[0].State)
	}
	qbFake.renErr = nil
	_ = loop.Tick(deps)
	if episodesOf(t, s)[0].State != protocol.StateDone || episodesOf(t, s)[0].LastError != "" {
		t.Fatalf("%+v", episodesOf(t, s)[0])
	}
}

func TestRenamingStateBeforeRenameFile(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	qbFake.setFiles(hash28, []qb.File{{Name: "[ANi] 葬送的芙莉莲 - 28 [1080P].mp4", Size: 1}})
	var saw protocol.EpisodeState
	qbFake.onRename = func(*fakeQB) {
		got := episodesOf(t, s)
		if len(got) > 0 {
			saw = got[0].State
		}
	}
	deps := loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library",
		FetchRSS: func(string) (string, error) { return rssXML("[ANi] 葬送的芙莉莲 - 28 [1080P]", hash28), nil },
	}
	_ = loop.Tick(deps)
	qbFake.complete(hash28)
	_ = loop.Tick(deps)
	if saw != protocol.StateRenaming {
		t.Fatalf("state=%s", saw)
	}
}

func TestAddFailure(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	qbFake.addErr = errors.New("qBittorrent add failed")
	_ = loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library",
		FetchRSS: func(string) (string, error) { return rssXML("[ANi] 葬送的芙莉莲 - 28 [1080P]", hash28), nil },
	})
	got := episodesOf(t, s)
	if len(got) != 1 || got[0].State != protocol.StateFailed || got[0].LastError != "qBittorrent add failed" {
		t.Fatalf("%+v", got)
	}
}

func TestSkipFailedOnNextRSS(t *testing.T) {
	season, ep := 1, 28
	s := seed(t, []protocol.Replica{replica("", "")}, map[string][]store.Episode{
		mapKey: {{EpisodeID: hash28, Infohash: hash28, Title: "t", Season: &season, Episode: &ep, State: protocol.StateFailed, LastError: "x"}},
	})
	qbFake := newFake()
	_ = loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library",
		FetchRSS: func(string) (string, error) { return rssXML("[ANi] 葬送的芙莉莲 - 28 [1080P]", hash28), nil },
	})
	if len(qbFake.added) != 0 {
		t.Fatal(qbFake.added)
	}
}

func TestBackfillRules(t *testing.T) {
	season, ep := 1, 28
	s := seed(t, []protocol.Replica{replica("", "")}, map[string][]store.Episode{
		mapKey: {{EpisodeID: hash28, Infohash: hash28, Title: "[ANi] 葬送的芙莉莲 - 28 [1080P]", Season: &season, Episode: &ep, State: protocol.StateDone}},
	})
	qbFake := newFake(qb.Torrent{Hash: hash27, Name: "manual", Progress: 1, State: "uploading"})
	got, err := loop.Backfill(loop.Deps{Store: s, QB: qbFake, LibraryRoot: "/library"}, "3141", "583", []mikan.RssEpisode{
		rssItem("[ANi] 葬送的芙莉莲 - 28 [1080P]", hash28),
		rssItem("[ANi] 葬送的芙莉莲 - 27 [1080P]", hash27),
		rssItem("[ANi] 葬送的芙莉莲 [1080P]", hashPack),
		rssItem("[LoliHouse] Example Show S02E07 [WebRip 1080p]", hashS2),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(qbFake.added) != 1 || qbFake.added[0].Rename != "葬送的芙莉莲 - S02E07" {
		t.Fatalf("%+v", qbFake.added)
	}
	if len(got) != 3 {
		t.Fatalf("%+v", got)
	}
}

func TestBackfillThenTickRenames(t *testing.T) {
	s := seed(t, nil, nil)
	qbFake := newFake()
	qbFake.setFiles(hash28, []qb.File{{Name: "[ANi] 葬送的芙莉莲 - 28 [1080P].mp4", Size: 700_000_000}})
	if _, err := loop.Backfill(loop.Deps{Store: s, QB: qbFake, LibraryRoot: "/library"}, "3141", "583", []mikan.RssEpisode{
		rssItem("[ANi] 葬送的芙莉莲 - 28 [1080P]", hash28),
	}); err != nil {
		t.Fatal(err)
	}
	reps, _ := s.LoadReplicas()
	if len(reps) != 0 {
		t.Fatal(reps)
	}
	qbFake.complete(hash28)
	_ = loop.Tick(loop.Deps{Store: s, QB: qbFake, LibraryRoot: "/library", FetchRSS: func(string) (string, error) { return "", nil }})
	if len(qbFake.renames) != 1 || qbFake.renames[0].To != "葬送的芙莉莲 - S01E28.mp4" {
		t.Fatalf("%+v", qbFake.renames)
	}
}

func TestSerializeTickAndBackfill(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	gate := make(chan struct{})
	ticking := make(chan error, 1)
	go func() {
		ticking <- loop.Tick(loop.Deps{
			Store: s, QB: qbFake, LibraryRoot: "/library",
			FetchRSS: func(string) (string, error) {
				<-gate
				return rssXML("[ANi] 葬送的芙莉莲 - 28 [1080P]", hash28), nil
			},
		})
	}()
	time.Sleep(20 * time.Millisecond)
	filling := make(chan error, 1)
	go func() {
		_, err := loop.Backfill(loop.Deps{Store: s, QB: qbFake, LibraryRoot: "/library"}, "3141", "583", []mikan.RssEpisode{
			rssItem("[ANi] 葬送的芙莉莲 - 27 [1080P]", hash27),
		})
		filling <- err
	}()
	time.Sleep(20 * time.Millisecond)
	close(gate)
	if err := <-ticking; err != nil {
		t.Fatal(err)
	}
	if err := <-filling; err != nil {
		t.Fatal(err)
	}
	got := episodesOf(t, s)
	ids := map[string]struct{}{}
	for _, item := range got {
		ids[item.EpisodeID] = struct{}{}
	}
	if _, ok := ids[hash28]; !ok {
		t.Fatalf("%+v", got)
	}
	if _, ok := ids[hash27]; !ok {
		t.Fatalf("%+v", got)
	}
}

func TestStartPollsImmediately(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	hits := make(chan struct{}, 4)
	stop := loop.Start(loop.Deps{
		Store: s, QB: newFake(), LibraryRoot: "/library",
		FetchRSS: func(string) (string, error) {
			hits <- struct{}{}
			return rssXML("[ANi] 葬送的芙莉莲 - 28 [1080P]", hash28), nil
		},
	}, time.Hour)
	select {
	case <-hits:
	case <-time.After(2 * time.Second):
		stop()
		t.Fatal("no immediate tick")
	}
	stop()
	time.Sleep(50 * time.Millisecond)
	if loop.DefaultPollIntervalMs != 600000 {
		t.Fatal(loop.DefaultPollIntervalMs)
	}
}

func TestResolveTitleFillsEpisode(t *testing.T) {
	rep := replica("", "")
	rep.BangumiSubjectID = "123"
	s := seed(t, []protocol.Replica{rep}, nil)
	qbFake := newFake()
	called := false
	_ = loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library",
		FetchRSS: func(string) (string, error) { return rssXML("[ANi] 葬送的芙莉莲 [1080P]", hash28), nil },
		ResolveTitle: func(replica protocol.Replica, item mikan.RssEpisode, parsed mikan.ParsedTitle) mikan.ParsedTitle {
			called = replica.BangumiSubjectID == "123"
			ep := 28
			season := 1
			parsed.Episode = &ep
			parsed.Season = &season
			return parsed
		},
	})
	if !called || len(qbFake.added) != 1 {
		t.Fatalf("called=%v added=%+v", called, qbFake.added)
	}
}

func TestMissingSubjectSkipsResolve(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	resolveHits := 0
	_ = loop.Tick(loop.Deps{
		Store: s, QB: newFake(), LibraryRoot: "/library",
		FetchRSS: func(string) (string, error) { return rssXML("[ANi] 葬送的芙莉莲 [1080P]", hash28), nil },
		ResolveTitle: func(replica protocol.Replica, item mikan.RssEpisode, parsed mikan.ParsedTitle) mikan.ParsedTitle {
			if replica.BangumiSubjectID != "" {
				resolveHits++
			}
			return parsed
		},
	})
	if resolveHits != 0 {
		t.Fatal(resolveHits)
	}
}
