package organize_test

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/analyze"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/organize"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/qb"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

const (
	movieHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	tvHash    = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	subHash   = "cccccccccccccccccccccccccccccccccccccccc"
)

type fakeQB struct {
	torrents []qb.Torrent
	files    map[string][]qb.File
}

func (f *fakeQB) ListTorrents() ([]qb.Torrent, error) {
	return append([]qb.Torrent(nil), f.torrents...), nil
}
func (f *fakeQB) AddTorrent(qb.AddRequest) (string, error) {
	return "", errors.New("unused")
}
func (f *fakeQB) ListFiles(hash string) ([]qb.File, error) {
	return append([]qb.File(nil), f.files[strings.ToLower(hash)]...), nil
}
func (f *fakeQB) RenameFile(string, string, string) error { return nil }

func profileWithTmdb(t *testing.T, key string) *store.ProfileStore {
	t.Helper()
	profile := store.NewProfileStore(t.TempDir())
	if key == "" {
		return profile
	}
	if _, err := profile.Apply(0, "test", []store.ProfileMutation{{
		Operation: "set", Key: "metadata.tmdb.apiKey", Value: key, Secret: true,
	}}); err != nil {
		t.Fatal(err)
	}
	return profile
}

func movieFetch(rawURL string) ([]byte, error) {
	if strings.Contains(rawURL, "/search/movie") {
		return []byte(`{"results":[{"id":603,"title":"The Matrix","original_title":"The Matrix","release_date":"1999-03-31"}]}`), nil
	}
	if strings.Contains(rawURL, "/search/tv") {
		return []byte(`{"results":[{"id":1396,"name":"Breaking Bad","original_name":"Breaking Bad","first_air_date":"2008-01-20"}]}`), nil
	}
	return nil, errors.New(rawURL)
}

func twoMovieFetch(string) ([]byte, error) {
	return []byte(`{"results":[{"id":1,"title":"The Matrix"},{"id":2,"title":"The Matrix Reloaded"}]}`), nil
}

func noUniqueFetch(string) ([]byte, error) {
	return []byte(`{"results":[{"id":1,"title":"Unrelated"},{"id":2,"title":"Also Unrelated"}]}`), nil
}

func serviceFor(t *testing.T, qbClient *fakeQB, key string, fetch func(string) ([]byte, error), library string) *organize.Service {
	t.Helper()
	return organize.New(organize.Deps{
		QB:          qbClient,
		Episodes:    store.New(t.TempDir()),
		Organized:   store.NewOrganizedStore(t.TempDir()),
		LibraryRoot: library,
		Profile:     profileWithTmdb(t, key),
		Fetch:       fetch,
		Now:         func() time.Time { return time.Date(2026, 8, 19, 0, 0, 0, 0, time.UTC) },
	})
}

func TestPlanSkippedHelperEpisode(t *testing.T) {
	dir := t.TempDir()
	episodes := store.New(dir)
	if err := episodes.SaveEpisodes(map[string][]store.Episode{
		store.EpisodeKey("b", "s"): {{
			EpisodeID: "e", Title: "ep", Infohash: subHash, State: protocol.StateDone,
		}},
	}); err != nil {
		t.Fatal(err)
	}
	svc := organize.New(organize.Deps{
		QB: &fakeQB{torrents: []qb.Torrent{{
			Hash: subHash, Name: "Show.S01E01", SavePath: dir, Progress: 1,
		}}},
		Episodes:    episodes,
		Organized:   store.NewOrganizedStore(t.TempDir()),
		LibraryRoot: dir,
		Profile:     profileWithTmdb(t, "k"),
		Fetch:       movieFetch,
	})
	got := svc.Plan(subHash)
	if got.Status != organize.StatusSkipped {
		t.Fatalf("%+v", got)
	}
}

func TestPlanSkippedHelperManagedIgnoresLLM(t *testing.T) {
	dir := t.TempDir()
	episodes := store.New(dir)
	if err := episodes.SaveEpisodes(map[string][]store.Episode{
		store.EpisodeKey("b", "s"): {{
			EpisodeID: "e", Title: "ep", Infohash: subHash, State: protocol.StateDone,
		}},
	}); err != nil {
		t.Fatal(err)
	}
	called := false
	svc := organize.New(organize.Deps{
		QB: &fakeQB{torrents: []qb.Torrent{{
			Hash: subHash, Name: "Show.S01E01", SavePath: dir, Progress: 1,
		}}},
		Episodes:    episodes,
		Organized:   store.NewOrganizedStore(t.TempDir()),
		LibraryRoot: dir,
		Profile:     profileWithTmdb(t, "k"),
		Fetch:       twoMovieFetch,
		Analyze: func(context.Context, analyze.Request) (*analyze.Identity, error) {
			called = true
			return &analyze.Identity{Title: "Show", MediaType: "tv", TMDBID: 1, Confidence: 0.99}, nil
		},
	})
	got := svc.Plan(subHash)
	if got.Status != organize.StatusSkipped || called {
		t.Fatalf("%+v called=%v", got, called)
	}
}

func TestPlanNeedsManualLibraryAndKey(t *testing.T) {
	qbClient := &fakeQB{torrents: []qb.Torrent{{
		Hash: movieHash, Name: "The.Matrix.1999.1080p.BluRay.x264", SavePath: "/dl", Progress: 1,
	}}, files: map[string][]qb.File{movieHash: {{Name: "The.Matrix.1999.mkv", Size: 10}}}}
	got := serviceFor(t, qbClient, "k", movieFetch, "").Plan(movieHash)
	if got.Status != organize.StatusNeedsManual || got.Reason != organize.ReasonMissingLibrary {
		t.Fatalf("%+v", got)
	}
	got = serviceFor(t, qbClient, "", movieFetch, t.TempDir()).Plan(movieHash)
	if got.Status != organize.StatusNeedsManual || got.Reason != organize.ReasonMissingTmdbKey {
		t.Fatalf("%+v", got)
	}
}

func TestPlanReadyMovieAndNeedsManualNoUnique(t *testing.T) {
	qbClient := &fakeQB{torrents: []qb.Torrent{{
		Hash: movieHash, Name: "The.Matrix.1999.1080p.BluRay.x264", SavePath: "/downloads", Progress: 1,
	}}, files: map[string][]qb.File{movieHash: {{Name: "The.Matrix.1999.1080p.BluRay.x264.mkv", Size: 10}}}}
	got := serviceFor(t, qbClient, "k", movieFetch, "/library").Plan(movieHash)
	if got.Status != organize.StatusReady || got.TmdbID != 603 || !strings.HasSuffix(got.LibraryRelPath, "The Matrix (1999).mkv") {
		t.Fatalf("%+v", got)
	}
	if !strings.HasPrefix(got.LibraryRelPath, "Movies/") {
		t.Fatalf("%+v", got)
	}
	got = serviceFor(t, qbClient, "k", twoMovieFetch, "/library").Plan(movieHash)
	if got.Status != organize.StatusNeedsManual || got.Reason != organize.ReasonNoUniqueTmdb {
		t.Fatalf("%+v", got)
	}
}

func TestPlanMessyNameAnalyzesBeforeTmdb(t *testing.T) {
	const messy = "www.Site.com.The.Matrix.1999.1080p.BluRay.x264-GROUP"
	qbClient := &fakeQB{torrents: []qb.Torrent{{
		Hash: movieHash, Name: messy, SavePath: "/downloads", Progress: 1,
	}}, files: map[string][]qb.File{movieHash: {{Name: messy + ".mkv", Size: 10}}}}
	var tmdbURLs []string
	searchedBeforeAnalyze := false
	analyzeCalls := 0
	svc := organize.New(organize.Deps{
		QB:          qbClient,
		Episodes:    store.New(t.TempDir()),
		Organized:   store.NewOrganizedStore(t.TempDir()),
		LibraryRoot: "/library",
		Profile:     profileWithTmdb(t, "k"),
		Fetch: func(rawURL string) ([]byte, error) {
			tmdbURLs = append(tmdbURLs, rawURL)
			if analyzeCalls == 0 && strings.Contains(rawURL, "/search/") {
				searchedBeforeAnalyze = true
			}
			if looksRawTmdbQuery(rawURL) {
				t.Fatalf("tmdb searched raw release: %s", rawURL)
			}
			return movieFetch(rawURL)
		},
		Analyze: func(_ context.Context, request analyze.Request) (*analyze.Identity, error) {
			analyzeCalls++
			if !strings.Contains(request.TorrentName, "www.Site.com") {
				t.Fatalf("%+v", request)
			}
			return &analyze.Identity{
				Title: "The Matrix", Year: 1999, MediaType: "movie", TMDBID: 603, Confidence: 0.94,
			}, nil
		},
		Now: func() time.Time { return time.Date(2026, 8, 19, 0, 0, 0, 0, time.UTC) },
	})
	got := svc.Plan(movieHash)
	if searchedBeforeAnalyze || analyzeCalls != 1 {
		t.Fatalf("order: analyzeCalls=%d searchedBefore=%v urls=%v", analyzeCalls, searchedBeforeAnalyze, tmdbURLs)
	}
	if got.Status != organize.StatusReady || got.TmdbID != 603 || !strings.Contains(got.LibraryRelPath, "The Matrix (1999)") {
		t.Fatalf("%+v", got)
	}
	for _, rawURL := range tmdbURLs {
		if looksRawTmdbQuery(rawURL) {
			t.Fatalf("raw tmdb query after analyze: %s", rawURL)
		}
	}
}

func looksRawTmdbQuery(rawURL string) bool {
	lower := strings.ToLower(rawURL)
	return strings.Contains(lower, "www") ||
		strings.Contains(lower, "site.com") ||
		strings.Contains(lower, "1080p") ||
		strings.Contains(lower, "bluray") ||
		strings.Contains(lower, "x264")
}

func TestPlanNeedsManualWhenUniqueAndLLMFail(t *testing.T) {
	qbClient := &fakeQB{torrents: []qb.Torrent{{
		Hash: movieHash, Name: "The.Matrix.1999.1080p.BluRay.x264", SavePath: "/downloads", Progress: 1,
	}}, files: map[string][]qb.File{movieHash: {{Name: "The.Matrix.1999.1080p.BluRay.x264.mkv", Size: 10}}}}
	svc := organize.New(organize.Deps{
		QB:          qbClient,
		Episodes:    store.New(t.TempDir()),
		Organized:   store.NewOrganizedStore(t.TempDir()),
		LibraryRoot: "/library",
		Profile:     profileWithTmdb(t, "k"),
		Fetch:       noUniqueFetch,
		Analyze: func(context.Context, analyze.Request) (*analyze.Identity, error) {
			return &analyze.Identity{Title: "Maybe", MediaType: "movie", TMDBID: 1, Confidence: 0.2}, nil
		},
	})
	got := svc.Plan(movieHash)
	if got.Status != organize.StatusNeedsManual || got.Reason != organize.ReasonNoUniqueTmdb {
		t.Fatalf("%+v", got)
	}
}

func TestPlanTvMissingEpisode(t *testing.T) {
	qbClient := &fakeQB{torrents: []qb.Torrent{{
		Hash: tvHash, Name: "Breaking Bad Season 1", SavePath: "/dl", Progress: 1,
	}}, files: map[string][]qb.File{tvHash: {{Name: "Breaking.Bad.S01.mkv", Size: 10}}}}
	got := serviceFor(t, qbClient, "k", movieFetch, "/library").Plan(tvHash)
	if got.Status != organize.StatusNeedsManual || got.Reason != organize.ReasonMissingEpisode {
		t.Fatalf("%+v", got)
	}
}

func TestPlanDoesNotReadConfigTmdbKey(t *testing.T) {
	qbClient := &fakeQB{torrents: []qb.Torrent{{
		Hash: movieHash, Name: "The.Matrix.1999", SavePath: "/dl", Progress: 1,
	}}, files: map[string][]qb.File{movieHash: {{Name: "The.Matrix.1999.mkv", Size: 10}}}}
	svc := organize.New(organize.Deps{
		QB:          qbClient,
		Episodes:    store.New(t.TempDir()),
		Organized:   store.NewOrganizedStore(t.TempDir()),
		LibraryRoot: "/library",
		Profile:     store.NewProfileStore(t.TempDir()),
		Fetch:       movieFetch,
	})
	got := svc.Plan(movieHash)
	if got.Reason != organize.ReasonMissingTmdbKey {
		t.Fatalf("%+v", got)
	}
}

func TestApplyHardlinkAndAlready(t *testing.T) {
	root := t.TempDir()
	save := filepath.Join(root, "dl")
	library := filepath.Join(root, "lib")
	if err := os.MkdirAll(save, 0o755); err != nil {
		t.Fatal(err)
	}
	src := filepath.Join(save, "The.Matrix.1999.mkv")
	if err := os.WriteFile(src, []byte("video-bytes"), 0o644); err != nil {
		t.Fatal(err)
	}
	qbClient := &fakeQB{torrents: []qb.Torrent{{
		Hash: movieHash, Name: "The.Matrix.1999", SavePath: save, Progress: 1,
	}}, files: map[string][]qb.File{movieHash: {{Name: "The.Matrix.1999.mkv", Size: 11}}}}
	svc := serviceFor(t, qbClient, "k", movieFetch, library)
	got := svc.Apply(movieHash)
	if got.Status != organize.StatusOK || got.Dest == "" {
		t.Fatalf("%+v", got)
	}
	srcInfo, _ := os.Stat(src)
	destInfo, err := os.Stat(got.Dest)
	if err != nil || !os.SameFile(srcInfo, destInfo) {
		t.Fatalf("hardlink missing: %v dest=%s", err, got.Dest)
	}
	if _, err := os.Stat(src); err != nil {
		t.Fatal("source was deleted")
	}
	again := svc.Apply(movieHash)
	if again.Status != organize.StatusAlready {
		t.Fatalf("%+v", again)
	}
}

func TestApplyCopyOnEXDEV(t *testing.T) {
	root := t.TempDir()
	save := filepath.Join(root, "dl")
	library := filepath.Join(root, "lib")
	if err := os.MkdirAll(save, 0o755); err != nil {
		t.Fatal(err)
	}
	src := filepath.Join(save, "The.Matrix.1999.mkv")
	if err := os.WriteFile(src, []byte("copied"), 0o644); err != nil {
		t.Fatal(err)
	}
	qbClient := &fakeQB{torrents: []qb.Torrent{{
		Hash: movieHash, Name: "The.Matrix.1999", SavePath: save, Progress: 1,
	}}, files: map[string][]qb.File{movieHash: {{Name: "The.Matrix.1999.mkv", Size: 6}}}}
	svc := organize.New(organize.Deps{
		QB:          qbClient,
		Episodes:    store.New(t.TempDir()),
		Organized:   store.NewOrganizedStore(t.TempDir()),
		LibraryRoot: library,
		Profile:     profileWithTmdb(t, "k"),
		Fetch:       movieFetch,
		Link:        func(string, string) error { return syscall.EXDEV },
	})
	got := svc.Apply(movieHash)
	if got.Status != organize.StatusOK {
		t.Fatalf("%+v", got)
	}
	raw, err := os.ReadFile(got.Dest)
	if err != nil || string(raw) != "copied" {
		t.Fatalf("%s %v", raw, err)
	}
	srcInfo, _ := os.Stat(src)
	destInfo, _ := os.Stat(got.Dest)
	if os.SameFile(srcInfo, destInfo) {
		t.Fatal("expected a copy, not a hard link")
	}
}

func TestApplyDoesNotOverwrite(t *testing.T) {
	root := t.TempDir()
	save := filepath.Join(root, "dl")
	library := filepath.Join(root, "lib")
	if err := os.MkdirAll(save, 0o755); err != nil {
		t.Fatal(err)
	}
	src := filepath.Join(save, "The.Matrix.1999.mkv")
	if err := os.WriteFile(src, []byte("source"), 0o644); err != nil {
		t.Fatal(err)
	}
	qbClient := &fakeQB{torrents: []qb.Torrent{{
		Hash: movieHash, Name: "The.Matrix.1999", SavePath: save, Progress: 1,
	}}, files: map[string][]qb.File{movieHash: {{Name: "The.Matrix.1999.mkv", Size: 6}}}}
	svc := serviceFor(t, qbClient, "k", movieFetch, library)
	plan := svc.Plan(movieHash)
	if err := os.MkdirAll(filepath.Dir(plan.Dest), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(plan.Dest, []byte("other"), 0o644); err != nil {
		t.Fatal(err)
	}
	got := svc.Apply(movieHash)
	if got.Status != organize.StatusNeedsManual || got.Reason != organize.ReasonDestConflict {
		t.Fatalf("%+v", got)
	}
	raw, _ := os.ReadFile(plan.Dest)
	if string(raw) != "other" {
		t.Fatalf("overwrote dest: %s", raw)
	}
}

func TestScanCompletedBaselinesExistingPile(t *testing.T) {
	org := store.NewOrganizedStore(t.TempDir())
	svc := organize.New(organize.Deps{
		QB: &fakeQB{torrents: []qb.Torrent{{
			Hash: movieHash, Name: "The.Matrix.1999", SavePath: "/dl", Progress: 1,
		}}, files: map[string][]qb.File{movieHash: {{Name: "The.Matrix.1999.mkv", Size: 10}}}},
		Episodes:    store.New(t.TempDir()),
		Organized:   org,
		LibraryRoot: "/library",
		Profile:     profileWithTmdb(t, "k"),
		Fetch:       movieFetch,
	})
	if err := svc.ScanCompleted([]qb.Torrent{{Hash: movieHash, Progress: 1}}); err != nil {
		t.Fatal(err)
	}
	rec, ok, err := org.Get(movieHash)
	if err != nil || !ok || rec.Status != organize.StatusDeferred {
		t.Fatalf("%+v %v %v", rec, ok, err)
	}
	if err := svc.ScanCompleted([]qb.Torrent{{Hash: movieHash, Progress: 1}}); err != nil {
		t.Fatal(err)
	}
	rec, ok, _ = org.Get(movieHash)
	if !ok || rec.Status != organize.StatusDeferred {
		t.Fatalf("existing pile was organized: %+v", rec)
	}
}
