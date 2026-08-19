package httpx_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/httpx"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

const (
	token       = "test-token"
	pairingCode = "ABC234"
)

func replica(id string) protocol.Replica {
	return protocol.Replica{
		ID:           id,
		BangumiID:    "bgm-1",
		Title:        "Title",
		SubgroupID:   "sg-1",
		SubgroupName: "Subgroup",
		RSSURL:       "https://example.com/rss",
	}
}

func start(t *testing.T, opts ...func(*httpx.Runtime)) *httptest.Server {
	t.Helper()
	dir := t.TempDir()
	st := store.New(dir)
	pairings := pairingStoreWithToken(t, dir, token)
	seedPairingCode(t, dir)
	rt := &httpx.Runtime{
		Version:        "0.0.1-test",
		Port:           17890,
		AdvertisedQbit: "http://127.0.0.1:8080",
		Pairings:       pairings,
		ProfileStore:   store.NewProfileStore(dir),
		Store:          st,
		DataDir:        dir,
	}
	for _, opt := range opts {
		opt(rt)
	}
	return httptest.NewServer(httpx.New(rt))
}

func startUnpaired(t *testing.T, opts ...func(*httpx.Runtime)) *httptest.Server {
	t.Helper()
	dir := t.TempDir()
	pairings, err := store.OpenPairingStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	seedPairingCode(t, dir)
	rt := &httpx.Runtime{
		Version:        "0.0.1-test",
		Port:           17890,
		AdvertisedQbit: "http://127.0.0.1:8080",
		Pairings:       pairings,
		ProfileStore:   store.NewProfileStore(dir),
		Store:          store.New(dir),
		DataDir:        dir,
	}
	for _, opt := range opts {
		opt(rt)
	}
	return httptest.NewServer(httpx.New(rt))
}

func seedPairingCode(t *testing.T, dir string) {
	t.Helper()
	if err := store.WritePairingCode(dir, pairingCode); err != nil {
		t.Fatal(err)
	}
}

func pairingStoreWithToken(t *testing.T, dir, rawToken string) *store.PairingStore {
	t.Helper()
	if err := os.WriteFile(
		filepath.Join(dir, "pairing.json"),
		[]byte(`{"bound":true,"token":"`+rawToken+`"}`),
		0o600,
	); err != nil {
		t.Fatal(err)
	}
	pairings, err := store.OpenPairingStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	return pairings
}

func decode(t *testing.T, res *http.Response) map[string]any {
	t.Helper()
	defer res.Body.Close()
	var body map[string]any
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	return body
}

func TestDiscoverUnauthenticated(t *testing.T) {
	srv := startUnpaired(t)
	defer srv.Close()
	res, err := http.Get(srv.URL + "/discover")
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
	body := decode(t, res)
	if body["version"] != "0.0.1-test" || body["bindState"] != "unbound" ||
		body["advertisedQbitUrl"] != "http://127.0.0.1:8080" ||
		body["clientCount"] != float64(0) || body["requiresPairingCode"] != true ||
		body["pairingCode"] != nil || body["port"] != float64(17890) {
		t.Fatalf("%+v", body)
	}
}

func TestPairRejectsWrongCode(t *testing.T) {
	srv := startUnpaired(t)
	defer srv.Close()
	res, err := http.Post(srv.URL+"/pair", "application/json", bytes.NewBufferString(`{"code":"ZZZZZZ"}`))
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 403 {
		t.Fatal(res.Status)
	}
	res.Body.Close()
	res, err = http.Post(srv.URL+"/pair", "application/json", bytes.NewBufferString(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 403 {
		t.Fatal(res.Status)
	}
	res.Body.Close()
}

func TestPairThrottlesRepeatedWrongCodes(t *testing.T) {
	srv := startUnpaired(t)
	defer srv.Close()
	for attempt := 1; attempt <= 5; attempt++ {
		res, err := http.Post(srv.URL+"/pair", "application/json", bytes.NewBufferString(`{"code":"ZZZZZZ"}`))
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusForbidden {
			t.Fatalf("attempt %d status=%s", attempt, res.Status)
		}
	}
	res, err := http.Post(srv.URL+"/pair", "application/json", bytes.NewBufferString(`{"code":"ABC234","clientId":"desktop"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status=%s", res.Status)
	}
	if res.Header.Get("retry-after") == "" {
		t.Fatal("missing retry-after header")
	}
	body := decode(t, res)
	if body["error"] != "tooManyAttempts" {
		t.Fatalf("%+v", body)
	}
}

func TestPairAcceptsRotatedCodeWithoutRestart(t *testing.T) {
	dir := t.TempDir()
	pairings, err := store.OpenPairingStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	seedPairingCode(t, dir)
	rt := &httpx.Runtime{
		Version: "0.0.1-test", Port: 17890, AdvertisedQbit: "http://q",
		Pairings: pairings, ProfileStore: store.NewProfileStore(dir), Store: store.New(dir), DataDir: dir,
	}
	srv := httptest.NewServer(httpx.New(rt))
	defer srv.Close()

	rotated, err := store.RotatePairingCode(dir)
	if err != nil {
		t.Fatal(err)
	}
	res, err := http.Post(srv.URL+"/pair", "application/json", bytes.NewBufferString(`{"code":"`+pairingCode+`","clientId":"desktop"}`))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("stale code status=%s", res.Status)
	}
	res, err = http.Post(srv.URL+"/pair", "application/json", bytes.NewBufferString(`{"code":"`+rotated+`","clientId":"desktop"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("rotated code status=%s", res.Status)
	}
}

func TestPairAcceptsLowercaseAndPaddedCode(t *testing.T) {
	srv := startUnpaired(t)
	defer srv.Close()
	res, err := http.Post(srv.URL+"/pair", "application/json", bytes.NewBufferString(`{"code":" abc234 ","clientId":"desktop"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status=%s", res.Status)
	}
}

func TestPairReturnsIndependentClientTokens(t *testing.T) {
	srv := startUnpaired(t)
	defer srv.Close()
	res, err := http.Post(srv.URL+"/pair", "application/json", bytes.NewBufferString(`{"code":"ABC234","clientId":"desktop","clientName":"Desktop"}`))
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
	body := decode(t, res)
	desktopToken, _ := body["token"].(string)
	if desktopToken == "" || body["clientId"] != "desktop" {
		t.Fatalf("%+v", body)
	}
	res, err = http.Post(srv.URL+"/pair", "application/json", bytes.NewBufferString(`{"code":"ABC234","clientId":"ios","clientName":"iPhone"}`))
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
	body = decode(t, res)
	iosToken, _ := body["token"].(string)
	if iosToken == "" || iosToken == desktopToken || body["clientId"] != "ios" {
		t.Fatalf("%+v", body)
	}
	res, err = http.Get(srv.URL + "/discover")
	if err != nil {
		t.Fatal(err)
	}
	body = decode(t, res)
	if body["bindState"] != "bound" || body["clientCount"] != float64(2) {
		t.Fatalf("%+v", body)
	}
}

func TestSubscriptionsRequiresBearer(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	res, err := http.Get(srv.URL + "/subscriptions")
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 401 {
		t.Fatal(res.Status)
	}
	res.Body.Close()
}

func TestGetSubscriptionsEmptyReplicasIsJSONArray(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/subscriptions", nil)
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatal(res.Status)
	}
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	var payload struct {
		Replicas json.RawMessage `json:"replicas"`
		Revision uint64          `json:"revision"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Revision != 0 {
		t.Fatalf("revision=%d body=%s", payload.Revision, raw)
	}
	if string(payload.Replicas) != "[]" {
		t.Fatalf("replicas=%s body=%s", payload.Replicas, raw)
	}
}

func TestPutSubscriptionsAppliesDiff(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	payload, _ := json.Marshal(map[string]any{"revision": 0, "replicas": []protocol.Replica{replica("1"), replica("2")}})
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/subscriptions", bytes.NewReader(payload))
	req.Header.Set("authorization", "Bearer "+token)
	req.Header.Set("content-type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
	body := decode(t, res)
	if body["revision"] != float64(1) {
		t.Fatalf("%+v", body)
	}

	payload, _ = json.Marshal(map[string]any{"revision": 1, "replicas": []protocol.Replica{replica("2")}})
	req, _ = http.NewRequest(http.MethodPut, srv.URL+"/subscriptions", bytes.NewReader(payload))
	req.Header.Set("authorization", "Bearer "+token)
	req.Header.Set("content-type", "application/json")
	res, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body = decode(t, res)
	raw, _ := json.Marshal(body["replicas"])
	var got []protocol.Replica
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].ID != "2" {
		t.Fatalf("%+v", got)
	}
}

func TestStatusIncludesJobs(t *testing.T) {
	dir := t.TempDir()
	st := store.New(dir)
	_ = st.SaveReplicas([]protocol.Replica{replica("1")})
	season, ep := 1, 1
	_ = st.SaveEpisodes(map[string][]store.Episode{
		store.EpisodeKey("bgm-1", "sg-1"): {{EpisodeID: "in", Title: "in", Season: &season, Episode: &ep, State: protocol.StateDone}},
		store.EpisodeKey("other", "sg"):   {{EpisodeID: "job", Title: "job", Season: &season, Episode: &ep, State: protocol.StateFailed}},
	})
	rt := &httpx.Runtime{
		Version: "0.0.1-test", Port: 17890, AdvertisedQbit: "http://q",
		Pairings: pairingStoreWithToken(t, dir, token), Store: st, DataDir: dir,
	}
	srv := httptest.NewServer(httpx.New(rt))
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/status", nil)
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body := decode(t, res)
	jobs, _ := body["jobs"].([]any)
	if len(jobs) != 1 {
		t.Fatalf("%+v", body)
	}
}

func TestBackfillInvokesCallback(t *testing.T) {
	called := false
	srv := start(t, func(rt *httpx.Runtime) {
		rt.OnBackfill = func(bangumiID, subgroupID string, episodes []mikan.RssEpisode) ([]store.Episode, error) {
			called = bangumiID == "3141" && subgroupID == "583" && len(episodes) == 1
			return []store.Episode{{EpisodeID: "e", Title: "t", State: protocol.StateAdded}}, nil
		}
	})
	defer srv.Close()
	payload := `{"bangumiId":"3141","subgroupId":"583","episodes":[{"episodeId":"e","title":"t","torrentUrl":"https://x"}]}`
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/backfill", bytes.NewBufferString(payload))
	req.Header.Set("authorization", "Bearer "+token)
	req.Header.Set("content-type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 || !called {
		io.ReadAll(res.Body)
		t.Fatalf("status=%s called=%v", res.Status, called)
	}
	res.Body.Close()
}

func TestUnpairRevokesOnlyCurrentClientAndKeepsStore(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	pairResponse, err := http.Post(
		srv.URL+"/pair",
		"application/json",
		bytes.NewBufferString(`{"code":"ABC234","clientId":"ios","clientName":"iPhone"}`),
	)
	if err != nil {
		t.Fatal(err)
	}
	if pairResponse.StatusCode != http.StatusOK {
		t.Fatalf("pair status=%v", pairResponse.Status)
	}
	iosBody := decode(t, pairResponse)
	iosToken, _ := iosBody["token"].(string)
	if iosToken == "" {
		t.Fatalf("%+v", iosBody)
	}

	payload, _ := json.Marshal(map[string]any{"revision": 0, "replicas": []protocol.Replica{replica("1")}})
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/subscriptions", bytes.NewReader(payload))
	req.Header.Set("authorization", "Bearer "+token)
	res, _ := http.DefaultClient.Do(req)
	if res.StatusCode != http.StatusOK {
		t.Fatal(res.Status)
	}
	res.Body.Close()

	req, _ = http.NewRequest(http.MethodPost, srv.URL+"/unpair", nil)
	req.Header.Set("authorization", "Bearer "+iosToken)
	res, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
	body := decode(t, res)
	if body["ok"] != true {
		t.Fatalf("%+v", body)
	}

	req, _ = http.NewRequest(http.MethodGet, srv.URL+"/subscriptions", nil)
	req.Header.Set("authorization", "Bearer "+iosToken)
	res, _ = http.DefaultClient.Do(req)
	if res.StatusCode != 401 {
		t.Fatal(res.Status)
	}
	res.Body.Close()

	req, _ = http.NewRequest(http.MethodGet, srv.URL+"/subscriptions", nil)
	req.Header.Set("authorization", "Bearer "+token)
	res, _ = http.DefaultClient.Do(req)
	if res.StatusCode != http.StatusOK {
		t.Fatal(res.Status)
	}
	body = decode(t, res)
	replicas, _ := body["replicas"].([]any)
	if len(replicas) != 1 {
		t.Fatalf("%+v", body)
	}

	res, _ = http.Get(srv.URL + "/discover")
	body = decode(t, res)
	if body["bindState"] != "bound" || body["clientCount"] != float64(1) {
		t.Fatalf("%+v", body)
	}
}

func TestPutSubscriptionsRejectsStaleClientRevision(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	pairResponse, err := http.Post(
		srv.URL+"/pair",
		"application/json",
		bytes.NewBufferString(`{"code":"ABC234","clientId":"ios","clientName":"iPhone"}`),
	)
	if err != nil {
		t.Fatal(err)
	}
	iosBody := decode(t, pairResponse)
	iosToken, _ := iosBody["token"].(string)

	write := func(rawToken string, revision uint64, items []protocol.Replica) (*http.Response, map[string]any) {
		payload, _ := json.Marshal(map[string]any{"revision": revision, "replicas": items})
		req, _ := http.NewRequest(http.MethodPut, srv.URL+"/subscriptions", bytes.NewReader(payload))
		req.Header.Set("authorization", "Bearer "+rawToken)
		req.Header.Set("content-type", "application/json")
		res, requestErr := http.DefaultClient.Do(req)
		if requestErr != nil {
			t.Fatal(requestErr)
		}
		return res, decode(t, res)
	}

	desktopReplica := replica("desktop")
	res, body := write(token, 0, []protocol.Replica{desktopReplica})
	if res.StatusCode != http.StatusOK || body["revision"] != float64(1) {
		t.Fatalf("status=%s body=%+v", res.Status, body)
	}
	iosReplica := replica("ios")
	res, body = write(iosToken, 0, []protocol.Replica{iosReplica})
	if res.StatusCode != http.StatusConflict || body["revision"] != float64(1) {
		t.Fatalf("status=%s body=%+v", res.Status, body)
	}
	replicas, _ := body["replicas"].([]any)
	if len(replicas) != 1 || replicas[0].(map[string]any)["id"] != "desktop" {
		t.Fatalf("%+v", body)
	}
}

func TestPutSubscriptionsRequiresRevision(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	payload, _ := json.Marshal(map[string]any{"replicas": []protocol.Replica{replica("1")}})
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/subscriptions", bytes.NewReader(payload))
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusPreconditionRequired {
		t.Fatal(res.Status)
	}
}

func keepReplica() protocol.Replica {
	item := replica("2")
	item.BangumiID = "bgm-keep"
	item.SubgroupID = "sg-keep"
	return item
}

func putSubscriptions(t *testing.T, srv *httptest.Server, payload []byte) map[string]any {
	t.Helper()
	get, _ := http.NewRequest(http.MethodGet, srv.URL+"/subscriptions", nil)
	get.Header.Set("authorization", "Bearer "+token)
	getResponse, err := http.DefaultClient.Do(get)
	if err != nil || getResponse.StatusCode != http.StatusOK {
		t.Fatalf("get status=%v err=%v", getResponse.Status, err)
	}
	snapshot := decode(t, getResponse)
	var body map[string]any
	if err := json.Unmarshal(payload, &body); err != nil {
		t.Fatal(err)
	}
	body["revision"] = snapshot["revision"]
	payload, _ = json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/subscriptions", bytes.NewReader(payload))
	req.Header.Set("authorization", "Bearer "+token)
	req.Header.Set("content-type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
	return decode(t, res)
}

func TestPutRemoveTorrentsDeletesHashes(t *testing.T) {
	var gotHashes []string
	var gotDelete bool
	dir := t.TempDir()
	st := store.New(dir)
	drop := replica("1")
	keep := keepReplica()
	if err := st.SaveReplicas([]protocol.Replica{drop, keep}); err != nil {
		t.Fatal(err)
	}
	if err := st.SaveEpisodes(map[string][]store.Episode{
		store.EpisodeKey("bgm-1", "sg-1"): {
			{EpisodeID: "e1", Title: "e1", Infohash: "aaa", State: protocol.StateDone},
			{EpisodeID: "e2", Title: "e2", State: protocol.StatePending},
		},
	}); err != nil {
		t.Fatal(err)
	}
	rt := &httpx.Runtime{
		Pairings: pairingStoreWithToken(t, dir, token), Store: st, DataDir: dir,
		OnDeleteTorrents: func(hashes []string, deleteFiles bool) error {
			gotHashes = append([]string(nil), hashes...)
			gotDelete = deleteFiles
			return nil
		},
	}
	srv := httptest.NewServer(httpx.New(rt))
	defer srv.Close()
	payload, _ := json.Marshal(map[string]any{
		"replicas":       []protocol.Replica{keep},
		"removeTorrents": true,
		"deleteFiles":    true,
	})
	body := putSubscriptions(t, srv, payload)
	raw, _ := json.Marshal(body["replicas"])
	var got []protocol.Replica
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].ID != "2" {
		t.Fatalf("%+v", got)
	}
	if len(gotHashes) != 1 || gotHashes[0] != "aaa" {
		t.Fatalf("%+v", gotHashes)
	}
	if !gotDelete {
		t.Fatal("deleteFiles")
	}
	episodes, err := st.LoadEpisodes()
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := episodes[store.EpisodeKey("bgm-1", "sg-1")]; ok {
		t.Fatalf("%+v", episodes)
	}
}

func TestPutWithoutRemoveTorrentsKeepsEpisodes(t *testing.T) {
	called := false
	dir := t.TempDir()
	st := store.New(dir)
	drop := replica("1")
	keep := keepReplica()
	if err := st.SaveReplicas([]protocol.Replica{drop, keep}); err != nil {
		t.Fatal(err)
	}
	if err := st.SaveEpisodes(map[string][]store.Episode{
		store.EpisodeKey("bgm-1", "sg-1"): {
			{EpisodeID: "e1", Title: "e1", Infohash: "aaa", State: protocol.StateDone},
		},
	}); err != nil {
		t.Fatal(err)
	}
	rt := &httpx.Runtime{
		Pairings: pairingStoreWithToken(t, dir, token), Store: st, DataDir: dir,
		OnDeleteTorrents: func(hashes []string, deleteFiles bool) error {
			called = true
			return nil
		},
	}
	srv := httptest.NewServer(httpx.New(rt))
	defer srv.Close()
	payload, _ := json.Marshal(map[string]any{"replicas": []protocol.Replica{keep}})
	putSubscriptions(t, srv, payload)
	if called {
		t.Fatal("OnDeleteTorrents")
	}
	episodes, err := st.LoadEpisodes()
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := episodes[store.EpisodeKey("bgm-1", "sg-1")]; !ok {
		t.Fatalf("%+v", episodes)
	}
}

func TestPutRemoveTorrentsKeepsMapOnDeleteError(t *testing.T) {
	dir := t.TempDir()
	st := store.New(dir)
	drop := replica("1")
	keep := keepReplica()
	if err := st.SaveReplicas([]protocol.Replica{drop, keep}); err != nil {
		t.Fatal(err)
	}
	if err := st.SaveEpisodes(map[string][]store.Episode{
		store.EpisodeKey("bgm-1", "sg-1"): {
			{EpisodeID: "e1", Title: "e1", Infohash: "aaa", State: protocol.StateDone},
		},
	}); err != nil {
		t.Fatal(err)
	}
	rt := &httpx.Runtime{
		Pairings: pairingStoreWithToken(t, dir, token), Store: st, DataDir: dir,
		OnDeleteTorrents: func(hashes []string, deleteFiles bool) error {
			return errors.New("qb down")
		},
	}
	srv := httptest.NewServer(httpx.New(rt))
	defer srv.Close()
	payload, _ := json.Marshal(map[string]any{
		"replicas":       []protocol.Replica{keep},
		"removeTorrents": true,
		"deleteFiles":    false,
	})
	body := putSubscriptions(t, srv, payload)
	raw, _ := json.Marshal(body["replicas"])
	var got []protocol.Replica
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].ID != "2" {
		t.Fatalf("%+v", got)
	}
	episodes, err := st.LoadEpisodes()
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := episodes[store.EpisodeKey("bgm-1", "sg-1")]; !ok {
		t.Fatalf("%+v", episodes)
	}
}
