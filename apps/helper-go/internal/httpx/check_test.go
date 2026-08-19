package httpx_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/config"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/events"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/httpx"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/loop"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/qb"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/redact"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

func putReplicasAt(t *testing.T, srv *http.Client, url string, revision uint64, items []protocol.Replica) *http.Response {
	t.Helper()
	payload, _ := json.Marshal(map[string]any{"revision": revision, "replicas": items})
	req, err := http.NewRequest(http.MethodPut, url, bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("authorization", "Bearer "+token)
	req.Header.Set("content-type", "application/json")
	res, err := srv.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return res
}

func TestPutSubscriptionsKicksOnceOnSuccessNotOnConflict(t *testing.T) {
	var mu sync.Mutex
	var sources []string
	srv := start(t, func(rt *httpx.Runtime) {
		rt.OnKick = func(source string) {
			mu.Lock()
			sources = append(sources, source)
			mu.Unlock()
		}
	})
	defer srv.Close()

	res := putReplicasAt(t, http.DefaultClient, srv.URL+"/subscriptions", 0, []protocol.Replica{replica("1")})
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("first put status=%s", res.Status)
	}

	res = putReplicasAt(t, http.DefaultClient, srv.URL+"/subscriptions", 0, []protocol.Replica{replica("2")})
	res.Body.Close()
	if res.StatusCode != http.StatusConflict {
		t.Fatalf("stale revision status=%s", res.Status)
	}

	res = putReplicasAt(t, http.DefaultClient, srv.URL+"/subscriptions", 1, []protocol.Replica{replica("1"), replica("2")})
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("second put status=%s", res.Status)
	}

	mu.Lock()
	got := append([]string(nil), sources...)
	mu.Unlock()
	if len(got) != 2 || got[0] != "subscriptions" || got[1] != "subscriptions" {
		t.Fatalf("kicks = %+v, want exactly one kick per successful put and none on the 409", got)
	}
}

func TestPutSubscriptionsDoesNotKickOnValidationOrMissingRevision(t *testing.T) {
	var kicks int32
	srv := start(t, func(rt *httpx.Runtime) {
		rt.OnKick = func(string) { atomic.AddInt32(&kicks, 1) }
	})
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/subscriptions", bytes.NewBufferString(`{"replicas":[]}`))
	req.Header.Set("authorization", "Bearer "+token)
	req.Header.Set("content-type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusPreconditionRequired {
		t.Fatalf("missing revision status=%s", res.Status)
	}

	req, _ = http.NewRequest(http.MethodPut, srv.URL+"/subscriptions", bytes.NewBufferString(`{"revision":0}`))
	req.Header.Set("authorization", "Bearer "+token)
	req.Header.Set("content-type", "application/json")
	res, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("missing replicas status=%s", res.Status)
	}

	if got := atomic.LoadInt32(&kicks); got != 0 {
		t.Fatalf("kicks = %d, want 0", got)
	}
}

func TestCheckRequiresAuthAndKicksWithSource(t *testing.T) {
	var mu sync.Mutex
	var sources []string
	srv := start(t, func(rt *httpx.Runtime) {
		rt.OnKick = func(source string) {
			mu.Lock()
			sources = append(sources, source)
			mu.Unlock()
		}
	})
	defer srv.Close()

	res, err := http.Post(srv.URL+"/check", "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauthenticated status=%s", res.Status)
	}

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/check", bytes.NewBufferString(`{"ignored":true}`))
	req.Header.Set("authorization", "Bearer "+token)
	req.Header.Set("content-type", "application/json")
	res, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusAccepted {
		t.Fatalf("status=%s", res.Status)
	}
	body := decode(t, res)
	if body["ok"] != true {
		t.Fatalf("%+v", body)
	}

	mu.Lock()
	got := append([]string(nil), sources...)
	mu.Unlock()
	if len(got) != 1 || got[0] != "check" {
		t.Fatalf("kicks = %+v", got)
	}
}

func TestDiscoverCapabilitiesIncludeCheckEventsLogs(t *testing.T) {
	srv := startUnpaired(t)
	defer srv.Close()
	res, err := http.Get(srv.URL + "/discover")
	if err != nil {
		t.Fatal(err)
	}
	body := decode(t, res)
	raw, _ := body["capabilities"].([]any)
	got := make(map[string]bool, len(raw))
	for _, item := range raw {
		s, _ := item.(string)
		got[s] = true
	}
	for _, want := range []string{"events", "logs", "check"} {
		if !got[want] {
			t.Fatalf("capabilities = %+v, missing %q", raw, want)
		}
	}
}

func TestPutAndCheckEmitSubscriptionEvents(t *testing.T) {
	dir := t.TempDir()
	registry := redact.NewRegistry()
	rec := events.New(dir, redact.Sanitizer(registry))
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Events = rec
	})
	defer srv.Close()

	res := putReplicasAt(t, http.DefaultClient, srv.URL+"/subscriptions", 0, []protocol.Replica{replica("1"), replica("2")})
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("put status=%s", res.Status)
	}

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/check", nil)
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()

	puts, _ := rec.Query(events.Query{Kind: "subscription.put"})
	if len(puts) != 1 {
		t.Fatalf("subscription.put events = %+v", puts)
	}
	if puts[0].Fields["added"] != 2 || puts[0].Fields["removed"] != 0 {
		t.Fatalf("fields = %+v", puts[0].Fields)
	}

	checks, _ := rec.Query(events.Query{Kind: "subscription.check"})
	if len(checks) != 2 {
		t.Fatalf("subscription.check events = %+v", checks)
	}
	if checks[0].Fields["source"] != "subscriptions" {
		t.Fatalf("first check source = %+v", checks[0].Fields)
	}
	if checks[1].Fields["source"] != "check" {
		t.Fatalf("second check source = %+v", checks[1].Fields)
	}
}

type reentrancyQB struct {
	inFlight int32
	violated int32
}

func (q *reentrancyQB) ListTorrents() ([]qb.Torrent, error) {
	if atomic.AddInt32(&q.inFlight, 1) > 1 {
		atomic.StoreInt32(&q.violated, 1)
	}
	time.Sleep(5 * time.Millisecond)
	atomic.AddInt32(&q.inFlight, -1)
	return nil, nil
}

func (q *reentrancyQB) AddTorrent(qb.AddRequest) (string, error) { return "", nil }
func (q *reentrancyQB) ListFiles(string) ([]qb.File, error)      { return nil, nil }
func (q *reentrancyQB) RenameFile(string, string, string) error  { return nil }

func TestCheckKicksDoNotReenterWithScheduledTick(t *testing.T) {
	dir := t.TempDir()
	st := store.New(dir)
	fakeQB := &reentrancyQB{}
	deps := loop.Deps{Store: st, QB: fakeQB}

	stop := loop.Start(deps, 2*time.Millisecond)

	var wg sync.WaitGroup
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Store = st
		rt.OnKick = func(string) {
			wg.Add(1)
			go func() {
				defer wg.Done()
				_ = loop.Tick(deps)
			}()
		}
	})
	defer srv.Close()

	const rounds = 20
	for i := 0; i < rounds; i++ {
		req, _ := http.NewRequest(http.MethodPost, srv.URL+"/check", nil)
		req.Header.Set("authorization", "Bearer "+token)
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusAccepted {
			t.Fatalf("status=%s", res.Status)
		}
	}
	wg.Wait()
	stop()
	time.Sleep(20 * time.Millisecond)

	if atomic.LoadInt32(&fakeQB.violated) != 0 {
		t.Fatal("detected concurrent loop.Tick execution: reentrancy guard failed")
	}
}

func TestConcurrentConfigWritesAndKickedCheckDoNotRace(t *testing.T) {
	var mismatches int32
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Config = config.File{QbitURL: "http://host-0", QbitPass: "pass-0", Category: "Bangumi"}
		rt.OnKick = func(string) {
			go func() {
				cfg := rt.CurrentConfig()
				wantPass := "pass-" + strings.TrimPrefix(cfg.QbitURL, "http://host-")
				if cfg.QbitPass != wantPass {
					atomic.AddInt32(&mismatches, 1)
				}
			}()
		}
	})
	defer srv.Close()

	var wg sync.WaitGroup
	const rounds = 50
	for i := 0; i < rounds; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			payload, _ := json.Marshal(map[string]any{
				"qbitUrl":  fmt.Sprintf("http://host-%d", i),
				"qbitPass": fmt.Sprintf("pass-%d", i),
			})
			req, _ := http.NewRequest(http.MethodPut, srv.URL+"/config", bytes.NewReader(payload))
			req.Header.Set("authorization", "Bearer "+token)
			req.Header.Set("content-type", "application/json")
			res, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Error(err)
				return
			}
			res.Body.Close()
		}(i)
		wg.Add(1)
		go func() {
			defer wg.Done()
			req, _ := http.NewRequest(http.MethodPost, srv.URL+"/check", nil)
			req.Header.Set("authorization", "Bearer "+token)
			res, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Error(err)
				return
			}
			res.Body.Close()
		}()
	}
	wg.Wait()
	time.Sleep(20 * time.Millisecond)

	if got := atomic.LoadInt32(&mismatches); got != 0 {
		t.Fatalf("observed a torn Config read: %d mismatches", got)
	}
}
