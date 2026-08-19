package store_test

import (
	"errors"
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
	snapshot, err := s.LoadReplicaSnapshot()
	if err != nil || snapshot.Revision != 0 {
		t.Fatalf("%v %+v", err, snapshot)
	}
	if snapshot.Replicas == nil {
		t.Fatal("empty snapshot returned nil replicas")
	}
	if len(snapshot.Replicas) != 0 {
		t.Fatalf("%+v", snapshot)
	}
}

func TestSaveReplicasIfRevisionEmptyIsNonNil(t *testing.T) {
	s := store.New(t.TempDir())
	snapshot, err := s.SaveReplicasIfRevision(nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Replicas == nil {
		t.Fatal("saved empty snapshot returned nil replicas")
	}
	if snapshot.Revision != 1 || len(snapshot.Replicas) != 0 {
		t.Fatalf("%+v", snapshot)
	}
}

func TestSaveReplicasRejectsStaleRevision(t *testing.T) {
	s := store.New(t.TempDir())
	first, err := s.SaveReplicasIfRevision([]protocol.Replica{{ID: "1"}}, 0)
	if err != nil || first.Revision != 1 {
		t.Fatalf("first=%+v err=%v", first, err)
	}
	conflict, err := s.SaveReplicasIfRevision([]protocol.Replica{{ID: "2"}}, 0)
	if !errors.Is(err, store.ErrRevisionConflict) {
		t.Fatalf("conflict=%+v err=%v", conflict, err)
	}
	if conflict.Revision != 1 || len(conflict.Replicas) != 1 || conflict.Replicas[0].ID != "1" {
		t.Fatalf("%+v", conflict)
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
