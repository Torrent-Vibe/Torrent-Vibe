package httpx_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/events"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/httpx"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/redact"
)

func getEvents(t *testing.T, srv *http.Client, url string) (int, map[string]any) {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("authorization", "Bearer "+token)
	res, err := srv.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return res.StatusCode, decode(t, res)
}

func eventSeqs(t *testing.T, body map[string]any) []float64 {
	t.Helper()
	raw, _ := body["events"].([]any)
	out := make([]float64, 0, len(raw))
	for _, item := range raw {
		entry, _ := item.(map[string]any)
		out = append(out, entry["seq"].(float64))
	}
	return out
}

func TestEventsRequiresBearer(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	res, err := http.Get(srv.URL + "/events")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status=%s", res.Status)
	}
}

func TestEventsCursorPaginationReturnsOnlyNewerAndAdvances(t *testing.T) {
	dir := t.TempDir()
	registry := redact.NewRegistry()
	rec := events.New(dir, redact.Sanitizer(registry))
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Events = rec
	})
	defer srv.Close()

	for i := 0; i < 5; i++ {
		rec.Emit(events.Event{Level: "info", Kind: "poll", Message: fmt.Sprintf("m%d", i)})
	}

	status, body := getEvents(t, http.DefaultClient, srv.URL+"/events")
	if status != http.StatusOK {
		t.Fatalf("status=%d body=%+v", status, body)
	}
	if body["cursor"] != float64(5) {
		t.Fatalf("cursor = %+v, want 5", body["cursor"])
	}
	if got := eventSeqs(t, body); len(got) != 5 || got[0] != 1 || got[4] != 5 {
		t.Fatalf("seqs = %+v", got)
	}

	status, body = getEvents(t, http.DefaultClient, srv.URL+"/events?since=3")
	if status != http.StatusOK {
		t.Fatalf("status=%d body=%+v", status, body)
	}
	if body["cursor"] != float64(5) {
		t.Fatalf("cursor = %+v, want 5", body["cursor"])
	}
	if got := eventSeqs(t, body); len(got) != 2 || got[0] != 4 || got[1] != 5 {
		t.Fatalf("seqs after since=3: %+v", got)
	}

	rec.Emit(events.Event{Level: "info", Kind: "poll", Message: "m5"})
	status, body = getEvents(t, http.DefaultClient, srv.URL+"/events?since=5")
	if status != http.StatusOK {
		t.Fatalf("status=%d body=%+v", status, body)
	}
	if body["cursor"] != float64(6) {
		t.Fatalf("cursor did not advance: %+v", body["cursor"])
	}
	if got := eventSeqs(t, body); len(got) != 1 || got[0] != 6 {
		t.Fatalf("seqs after second poll: %+v", got)
	}
}

func TestEventsLevelAndReplicaIDFilters(t *testing.T) {
	dir := t.TempDir()
	registry := redact.NewRegistry()
	rec := events.New(dir, redact.Sanitizer(registry))
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Events = rec
	})
	defer srv.Close()

	rec.Emit(events.Event{Level: "debug", Kind: "poll", ReplicaID: "r1", Message: "1"})
	rec.Emit(events.Event{Level: "info", Kind: "poll", ReplicaID: "r1", Message: "2"})
	rec.Emit(events.Event{Level: "warn", Kind: "download", ReplicaID: "r1", Message: "3"})
	rec.Emit(events.Event{Level: "error", Kind: "download", ReplicaID: "r2", Message: "4"})

	status, body := getEvents(t, http.DefaultClient, srv.URL+"/events?level=warn")
	if status != http.StatusOK {
		t.Fatalf("status=%d body=%+v", status, body)
	}
	if got := eventSeqs(t, body); len(got) != 2 || got[0] != 3 || got[1] != 4 {
		t.Fatalf("level filter: %+v", got)
	}

	status, body = getEvents(t, http.DefaultClient, srv.URL+"/events?replicaId=r2")
	if status != http.StatusOK {
		t.Fatalf("status=%d body=%+v", status, body)
	}
	if got := eventSeqs(t, body); len(got) != 1 || got[0] != 4 {
		t.Fatalf("replicaId filter: %+v", got)
	}
}

func TestEventsLimitCapAndInvalidParamsTreatedAsAbsent(t *testing.T) {
	dir := t.TempDir()
	registry := redact.NewRegistry()
	rec := events.New(dir, redact.Sanitizer(registry))
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Events = rec
	})
	defer srv.Close()

	for i := 0; i < events.MaxQueryLimit+50; i++ {
		rec.Emit(events.Event{Level: "info", Kind: "poll", Message: "x"})
	}

	status, body := getEvents(t, http.DefaultClient, srv.URL+"/events?limit=5000")
	if status != http.StatusOK {
		t.Fatalf("status=%d body=%+v", status, body)
	}
	if got := eventSeqs(t, body); len(got) != events.MaxQueryLimit {
		t.Fatalf("limit cap: len = %d, want %d", len(got), events.MaxQueryLimit)
	}

	status, body = getEvents(t, http.DefaultClient, srv.URL+"/events?limit=notanumber")
	if status != http.StatusOK {
		t.Fatalf("invalid limit should not error: status=%d body=%+v", status, body)
	}
	if got := eventSeqs(t, body); len(got) != events.DefaultQueryLimit {
		t.Fatalf("invalid limit not treated as absent: len = %d, want %d", len(got), events.DefaultQueryLimit)
	}

	status, body = getEvents(t, http.DefaultClient, srv.URL+"/events?since=notanumber")
	if status != http.StatusOK {
		t.Fatalf("invalid since should not error: status=%d body=%+v", status, body)
	}
	if got := eventSeqs(t, body); len(got) != events.DefaultQueryLimit {
		t.Fatalf("invalid since not treated as absent (want since=0): len = %d, want %d", len(got), events.DefaultQueryLimit)
	}
}

func TestEventsEmptyResultIsJSONArrayNotNull(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/events", nil)
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status=%s", res.Status)
	}
	var raw struct {
		Events json.RawMessage `json:"events"`
		Cursor uint64          `json:"cursor"`
	}
	if err := json.NewDecoder(res.Body).Decode(&raw); err != nil {
		t.Fatal(err)
	}
	if string(raw.Events) != "[]" {
		t.Fatalf("events = %s, want []", raw.Events)
	}
	if raw.Cursor != 0 {
		t.Fatalf("cursor = %d, want 0", raw.Cursor)
	}
}
