package store_test

import (
	"errors"
	"sync"
	"testing"
	"time"

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
	_ = s.SaveReplicaChecks(map[string]store.ReplicaCheck{
		store.EpisodeKey("b", "s"): {CheckedAt: time.Now(), ConsecutiveFailures: 2},
	})
	if err := s.ClearAll(); err != nil {
		t.Fatal(err)
	}
	reps, _ := s.LoadReplicas()
	eps, _ := s.LoadEpisodes()
	checks, _ := s.LoadReplicaChecks()
	if len(reps) != 0 || len(eps) != 0 || len(checks) != 0 {
		t.Fatal("not cleared")
	}
}

func TestReplicaChecksRoundTrip(t *testing.T) {
	dir := t.TempDir()
	s := store.New(dir)
	at := time.Date(2026, 8, 20, 12, 0, 0, 0, time.UTC)
	key := store.EpisodeKey("b", "s")
	if err := s.SaveReplicaChecks(map[string]store.ReplicaCheck{
		key: {CheckedAt: at, ConsecutiveFailures: 3, CheckError: "mikan unreachable"},
	}); err != nil {
		t.Fatal(err)
	}
	got, err := s.LoadReplicaChecks()
	if err != nil {
		t.Fatal(err)
	}
	check, ok := got[key]
	if !ok {
		t.Fatalf("missing key: %+v", got)
	}
	if !check.CheckedAt.Equal(at) || check.ConsecutiveFailures != 3 || check.CheckError != "mikan unreachable" {
		t.Fatalf("%+v", check)
	}
}

func TestLoadReplicaChecksMissingFileIsEmpty(t *testing.T) {
	s := store.New(t.TempDir())
	got, err := s.LoadReplicaChecks()
	if err != nil {
		t.Fatal(err)
	}
	if got == nil {
		t.Fatal("nil map returned")
	}
	if len(got) != 0 {
		t.Fatalf("%+v", got)
	}
}

func TestRecordReplicaCheckSuccessResetsCounter(t *testing.T) {
	dir := t.TempDir()
	s := store.New(dir)
	key := store.EpisodeKey("b", "s")
	if err := s.SaveReplicaChecks(map[string]store.ReplicaCheck{
		key: {ConsecutiveFailures: 3, CheckError: "boom"},
	}); err != nil {
		t.Fatal(err)
	}
	at := time.Date(2026, 8, 20, 12, 0, 0, 0, time.UTC)
	if err := s.RecordReplicaCheck(key, at, nil); err != nil {
		t.Fatal(err)
	}
	got, err := s.LoadReplicaChecks()
	if err != nil {
		t.Fatal(err)
	}
	check := got[key]
	if check.ConsecutiveFailures != 0 || check.CheckError != "" || !check.CheckedAt.Equal(at) {
		t.Fatalf("%+v", check)
	}
}

func TestRecordReplicaCheckFailureIncrementsCounter(t *testing.T) {
	dir := t.TempDir()
	s := store.New(dir)
	key := store.EpisodeKey("b", "s")
	first := time.Date(2026, 8, 20, 12, 0, 0, 0, time.UTC)
	if err := s.RecordReplicaCheck(key, first, errors.New("mikan unreachable")); err != nil {
		t.Fatal(err)
	}
	second := first.Add(10 * time.Minute)
	if err := s.RecordReplicaCheck(key, second, errors.New("mikan unreachable")); err != nil {
		t.Fatal(err)
	}
	got, err := s.LoadReplicaChecks()
	if err != nil {
		t.Fatal(err)
	}
	check := got[key]
	if check.ConsecutiveFailures != 2 || check.CheckError != "mikan unreachable" || !check.CheckedAt.Equal(second) {
		t.Fatalf("%+v", check)
	}
}

func TestRecordReplicaCheckLeavesOtherReplicasAlone(t *testing.T) {
	dir := t.TempDir()
	s := store.New(dir)
	other := store.EpisodeKey("other", "sg")
	untouched := time.Date(2026, 8, 20, 11, 0, 0, 0, time.UTC)
	if err := s.SaveReplicaChecks(map[string]store.ReplicaCheck{
		other: {CheckedAt: untouched, ConsecutiveFailures: 1},
	}); err != nil {
		t.Fatal(err)
	}
	if err := s.RecordReplicaCheck(store.EpisodeKey("b", "s"), time.Now(), nil); err != nil {
		t.Fatal(err)
	}
	got, err := s.LoadReplicaChecks()
	if err != nil {
		t.Fatal(err)
	}
	check := got[other]
	if !check.CheckedAt.Equal(untouched) || check.ConsecutiveFailures != 1 {
		t.Fatalf("%+v", check)
	}
}

func TestRecordReplicaCheckConcurrentFailuresLoseNoUpdates(t *testing.T) {
	dir := t.TempDir()
	s := store.New(dir)
	key := store.EpisodeKey("b", "s")
	const n = 50
	var wg sync.WaitGroup
	wg.Add(n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			_ = s.RecordReplicaCheck(key, time.Now(), errors.New("mikan unreachable"))
		}()
	}
	wg.Wait()
	got, err := s.LoadReplicaChecks()
	if err != nil {
		t.Fatal(err)
	}
	check := got[key]
	if check.ConsecutiveFailures != n {
		t.Fatalf("consecutiveFailures = %d, want %d (lost update under concurrency)", check.ConsecutiveFailures, n)
	}
}
