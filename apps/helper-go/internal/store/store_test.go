package store_test

import (
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

func TestStoreRoundTrip(t *testing.T) {
	dir := t.TempDir()
	s := store.New(dir)
	r := protocol.Replica{ID: "1", BangumiID: "b", Title: "T", SubgroupID: "s", SubgroupName: "S", RSSURL: "https://x"}
	if err := s.SaveReplicas([]protocol.Replica{r}); err != nil {
		t.Fatal(err)
	}
	season, ep := 1, 28
	if err := s.SaveEpisodes(map[string][]store.Episode{
		store.EpisodeKey("b", "s"): {{EpisodeID: "e", Title: "t", Season: &season, Episode: &ep, State: protocol.StateAdded}},
	}); err != nil {
		t.Fatal(err)
	}
	got, _ := s.LoadReplicas()
	if len(got) != 1 || got[0].ID != "1" {
		t.Fatalf("%+v", got)
	}
	eps, _ := s.LoadEpisodes()
	if len(eps[store.EpisodeKey("b", "s")]) != 1 {
		t.Fatalf("%+v", eps)
	}
}

func TestStoreMissingFileIsEmpty(t *testing.T) {
	s := store.New(t.TempDir())
	reps, err := s.LoadReplicas()
	if err != nil || len(reps) != 0 {
		t.Fatalf("%v %+v", err, reps)
	}
}

func TestClearAll(t *testing.T) {
	dir := t.TempDir()
	s := store.New(dir)
	_ = s.SaveReplicas([]protocol.Replica{{ID: "1", BangumiID: "b", Title: "T", SubgroupID: "s", SubgroupName: "S", RSSURL: "https://x"}})
	if err := s.ClearAll(); err != nil {
		t.Fatal(err)
	}
	reps, _ := s.LoadReplicas()
	eps, _ := s.LoadEpisodes()
	if len(reps) != 0 || len(eps) != 0 {
		t.Fatal("not cleared")
	}
}
