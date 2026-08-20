package events_test

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/events"
)

func TestRingWrapsAndKeepsNewest(t *testing.T) {
	r := events.New(t.TempDir(), nil)
	total := events.RingCapacity + 500
	for i := 0; i < total; i++ {
		r.Emit(events.Event{Level: "info", Kind: "poll", Message: fmt.Sprintf("m%d", i)})
	}

	got, cursor := r.Query(events.Query{Since: 0, Limit: events.MaxQueryLimit})
	wantFirstSeq := uint64(total - events.RingCapacity + 1)
	wantCursor := wantFirstSeq + uint64(events.MaxQueryLimit) - 1
	if cursor != wantCursor {
		t.Fatalf("cursor = %d, want %d (last returned event's seq, page was capped by the limit)", cursor, wantCursor)
	}
	if len(got) != events.MaxQueryLimit {
		t.Fatalf("len(got) = %d, want %d", len(got), events.MaxQueryLimit)
	}
	if got[0].Seq != wantFirstSeq {
		t.Fatalf("got[0].Seq = %d, want %d (oldest surviving event)", got[0].Seq, wantFirstSeq)
	}

	newest, _ := r.Query(events.Query{Since: uint64(total - 1), Limit: 1})
	if len(newest) != 1 || newest[0].Seq != uint64(total) {
		t.Fatalf("newest = %+v, want seq %d", newest, total)
	}
}

func TestCursorResumesWithoutSkippingAcrossCappedPage(t *testing.T) {
	r := events.New(t.TempDir(), nil)
	const total = 10
	for i := 0; i < total; i++ {
		r.Emit(events.Event{Level: "info", Kind: "poll", Message: fmt.Sprintf("m%d", i)})
	}

	var since uint64
	var seen []uint64
	for len(seen) < total {
		page, cursor := r.Query(events.Query{Since: since, Limit: 4})
		if len(page) == 0 {
			t.Fatalf("page starved before collecting all events: seen=%v", seen)
		}
		for _, e := range page {
			seen = append(seen, e.Seq)
		}
		if cursor == since {
			t.Fatalf("cursor did not advance: since=%d cursor=%d", since, cursor)
		}
		since = cursor
	}

	if len(seen) != total {
		t.Fatalf("len(seen) = %d, want %d: %v", len(seen), total, seen)
	}
	for i, seq := range seen {
		if seq != uint64(i+1) {
			t.Fatalf("seen[%d] = %d, want %d (no gaps or duplicates): %v", i, seq, i+1, seen)
		}
	}
}

func TestSeqMonotonicUnderConcurrentEmit(t *testing.T) {
	r := events.New(t.TempDir(), nil)
	const goroutines = 50
	const perGoroutine = 20
	const total = goroutines * perGoroutine

	var wg sync.WaitGroup
	wg.Add(goroutines)
	for g := 0; g < goroutines; g++ {
		go func() {
			defer wg.Done()
			for i := 0; i < perGoroutine; i++ {
				r.Emit(events.Event{Level: "info", Kind: "poll", Message: "x"})
			}
		}()
	}
	wg.Wait()

	got, cursor := r.Query(events.Query{Since: 0, Limit: total})
	if cursor != uint64(total) {
		t.Fatalf("cursor = %d, want %d", cursor, total)
	}
	if len(got) != total {
		t.Fatalf("len(got) = %d, want %d", len(got), total)
	}
	seen := make(map[uint64]bool, total)
	for _, e := range got {
		if e.Seq == 0 {
			t.Fatal("seq must not be zero")
		}
		if seen[e.Seq] {
			t.Fatalf("duplicate seq %d", e.Seq)
		}
		seen[e.Seq] = true
	}
}

func TestQueryFiltersBySinceLevelKindReplicaID(t *testing.T) {
	r := events.New(t.TempDir(), nil)
	r.Emit(events.Event{Level: "debug", Kind: "poll", ReplicaID: "r1", Message: "1"})
	r.Emit(events.Event{Level: "info", Kind: "poll", ReplicaID: "r1", Message: "2"})
	r.Emit(events.Event{Level: "warn", Kind: "download", ReplicaID: "r1", Message: "3"})
	r.Emit(events.Event{Level: "error", Kind: "download", ReplicaID: "r2", Message: "4"})

	warnAndAbove, _ := r.Query(events.Query{Level: "warn"})
	if len(warnAndAbove) != 2 || warnAndAbove[0].Message != "3" || warnAndAbove[1].Message != "4" {
		t.Fatalf("level filter: %+v", warnAndAbove)
	}

	byKind, _ := r.Query(events.Query{Kind: "download"})
	if len(byKind) != 2 || byKind[0].Message != "3" || byKind[1].Message != "4" {
		t.Fatalf("kind filter: %+v", byKind)
	}

	byReplica, _ := r.Query(events.Query{ReplicaID: "r2"})
	if len(byReplica) != 1 || byReplica[0].Message != "4" {
		t.Fatalf("replicaId filter: %+v", byReplica)
	}

	sinceTwo, cursor := r.Query(events.Query{Since: 2})
	if len(sinceTwo) != 2 || sinceTwo[0].Message != "3" || sinceTwo[1].Message != "4" {
		t.Fatalf("since filter: %+v", sinceTwo)
	}
	if cursor != 4 {
		t.Fatalf("cursor = %d, want 4", cursor)
	}
}

func TestQueryLimitDefaultAndCap(t *testing.T) {
	r := events.New(t.TempDir(), nil)
	for i := 0; i < 1500; i++ {
		r.Emit(events.Event{Level: "info", Kind: "poll", Message: "x"})
	}

	withDefault, _ := r.Query(events.Query{})
	if len(withDefault) != events.DefaultQueryLimit {
		t.Fatalf("default limit: len = %d, want %d", len(withDefault), events.DefaultQueryLimit)
	}

	withOversized, _ := r.Query(events.Query{Limit: 5000})
	if len(withOversized) != events.MaxQueryLimit {
		t.Fatalf("capped limit: len = %d, want %d", len(withOversized), events.MaxQueryLimit)
	}
}

func TestJSONLLinesRoundTrip(t *testing.T) {
	dir := t.TempDir()
	r := events.New(dir, nil)
	r.Emit(events.Event{Level: "info", Kind: "poll", ReplicaID: "r1", Message: "hello", Fields: map[string]any{"n": float64(3)}})
	r.Emit(events.Event{Level: "error", Kind: "download", BangumiID: "b1", Message: "boom"})

	day := time.Now().UTC().Format("20060102")
	path := filepath.Join(dir, "logs", "events-"+day+".jsonl")
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	var lines []events.Event
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		var e events.Event
		if err := json.Unmarshal(scanner.Bytes(), &e); err != nil {
			t.Fatalf("unmarshal line: %v", err)
		}
		lines = append(lines, e)
	}
	if err := scanner.Err(); err != nil {
		t.Fatal(err)
	}

	if len(lines) != 2 {
		t.Fatalf("len(lines) = %d, want 2", len(lines))
	}
	if lines[0].Seq != 1 || lines[0].Message != "hello" || lines[0].ReplicaID != "r1" {
		t.Fatalf("line 0 = %+v", lines[0])
	}
	if lines[0].Fields["n"] != float64(3) {
		t.Fatalf("line 0 fields = %+v", lines[0].Fields)
	}
	if lines[1].Seq != 2 || lines[1].Message != "boom" || lines[1].BangumiID != "b1" {
		t.Fatalf("line 1 = %+v", lines[1])
	}
}

func TestFilesOlderThanSevenDaysArePruned(t *testing.T) {
	dir := t.TempDir()
	logsDir := filepath.Join(dir, "logs")
	if err := os.MkdirAll(logsDir, 0o755); err != nil {
		t.Fatal(err)
	}

	now := time.Now().UTC()
	writeStub := func(daysAgo int) string {
		day := now.AddDate(0, 0, -daysAgo).Format("20060102")
		name := "events-" + day + ".jsonl"
		if err := os.WriteFile(filepath.Join(logsDir, name), []byte("{}\n"), 0o600); err != nil {
			t.Fatal(err)
		}
		return name
	}

	keepToday := writeStub(0)
	keepSixDaysAgo := writeStub(6)
	keepSevenDaysAgo := writeStub(7)
	pruneEightDaysAgo := writeStub(8)
	pruneThirtyDaysAgo := writeStub(30)

	r := events.New(dir, nil)
	r.Emit(events.Event{Level: "info", Kind: "poll", Message: "rotate"})

	assertExists := func(name string, want bool) {
		_, err := os.Stat(filepath.Join(logsDir, name))
		exists := err == nil
		if exists != want {
			t.Fatalf("%s exists = %v, want %v", name, exists, want)
		}
	}
	assertExists(keepToday, true)
	assertExists(keepSixDaysAgo, true)
	assertExists(keepSevenDaysAgo, true)
	assertExists(pruneEightDaysAgo, false)
	assertExists(pruneThirtyDaysAgo, false)
}

func TestSanitizerRunsBeforeStorage(t *testing.T) {
	dir := t.TempDir()
	sanitizer := func(e events.Event) events.Event {
		e.Message = "[redacted]"
		return e
	}
	r := events.New(dir, sanitizer)
	r.Emit(events.Event{Level: "info", Kind: "poll", Message: "secret-token"})

	got, _ := r.Query(events.Query{})
	if len(got) != 1 || got[0].Message != "[redacted]" {
		t.Fatalf("ring buffer not sanitized: %+v", got)
	}

	day := time.Now().UTC().Format("20060102")
	path := filepath.Join(dir, "logs", "events-"+day+".jsonl")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !containsOnly(raw, "[redacted]") {
		t.Fatalf("disk not sanitized: %s", raw)
	}
}

func containsOnly(raw []byte, want string) bool {
	var e events.Event
	if err := json.Unmarshal(raw[:len(raw)-1], &e); err != nil {
		return false
	}
	return e.Message == want
}
