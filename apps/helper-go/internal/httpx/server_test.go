package httpx_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
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
	rt := &httpx.Runtime{
		Version:        "0.0.1-test",
		Port:           17890,
		AdvertisedQbit: "http://127.0.0.1:8080",
		PairingCode:    pairingCode,
		Token:          token,
		Bound:          false,
		Store:          st,
		DataDir:        dir,
	}
	for _, opt := range opts {
		opt(rt)
	}
	return httptest.NewServer(httpx.New(rt))
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
	srv := start(t)
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
		body["pairingCode"] != pairingCode || body["port"] != float64(17890) {
		t.Fatalf("%+v", body)
	}
}

func TestPairRejectsWrongCode(t *testing.T) {
	srv := start(t)
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

func TestPairReturnsTokenAndBinds(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	res, err := http.Post(srv.URL+"/pair", "application/json", bytes.NewBufferString(`{"code":"ABC234"}`))
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
	body := decode(t, res)
	if body["token"] != token {
		t.Fatalf("%+v", body)
	}
	res, err = http.Post(srv.URL+"/pair", "application/json", bytes.NewBufferString(`{"code":"ABC234"}`))
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
	body = decode(t, res)
	if body["token"] != token {
		t.Fatalf("%+v", body)
	}
	res, err = http.Get(srv.URL + "/discover")
	if err != nil {
		t.Fatal(err)
	}
	body = decode(t, res)
	if body["bindState"] != "bound" {
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

func TestPutSubscriptionsAppliesDiff(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	payload, _ := json.Marshal(map[string]any{"replicas": []protocol.Replica{replica("1"), replica("2")}})
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
	decode(t, res)

	payload, _ = json.Marshal(map[string]any{"replicas": []protocol.Replica{replica("2")}})
	req, _ = http.NewRequest(http.MethodPut, srv.URL+"/subscriptions", bytes.NewReader(payload))
	req.Header.Set("authorization", "Bearer "+token)
	req.Header.Set("content-type", "application/json")
	res, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body := decode(t, res)
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
		PairingCode: pairingCode, Token: token, Store: st, DataDir: dir,
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

func TestUnpairRotatesTokenAndClearsStore(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	payload, _ := json.Marshal(map[string]any{"replicas": []protocol.Replica{replica("1")}})
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/subscriptions", bytes.NewReader(payload))
	req.Header.Set("authorization", "Bearer "+token)
	res, _ := http.DefaultClient.Do(req)
	res.Body.Close()

	req, _ = http.NewRequest(http.MethodPost, srv.URL+"/unpair", nil)
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
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
	req.Header.Set("authorization", "Bearer "+token)
	res, _ = http.DefaultClient.Do(req)
	if res.StatusCode != 401 {
		t.Fatal(res.Status)
	}
	res.Body.Close()

	res, _ = http.Get(srv.URL + "/discover")
	body = decode(t, res)
	if body["bindState"] != "unbound" {
		t.Fatalf("%+v", body)
	}

	res, _ = http.Post(srv.URL+"/pair", "application/json", bytes.NewBufferString(`{"code":"ABC234"}`))
	body = decode(t, res)
	if body["token"] == token || body["token"] == "" {
		t.Fatalf("expected rotated token, got %+v", body)
	}
}
