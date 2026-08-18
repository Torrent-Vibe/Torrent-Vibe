package httpx_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/config"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/httpx"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

func TestConfigRequiresAuth(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	res, err := http.Get(srv.URL + "/config")
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 401 {
		t.Fatal(res.Status)
	}
	res.Body.Close()
}

func TestGetConfigOmitsPassword(t *testing.T) {
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Config = config.File{LibraryRoot: "/tv", Category: "Bangumi", QbitURL: "http://q", QbitUser: "admin", QbitPass: "secret", PollIntervalMs: 1000}
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/config", nil)
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body := decode(t, res)
	if body["libraryRoot"] != "/tv" || body["hasQbitPass"] != true || body["qbitPass"] != nil {
		t.Fatalf("%+v", body)
	}
}

func TestPutConfigPersistsAndApplies(t *testing.T) {
	var applied config.File
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Config = config.File{Category: "Bangumi", QbitURL: "http://q", QbitUser: "u", PollIntervalMs: 600000}
		rt.ApplyConfig = func(file config.File) { applied = file }
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/config", bytes.NewBufferString(`{"libraryRoot":"/tv"}`))
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
	if body["libraryRoot"] != "/tv" || applied.LibraryRoot != "/tv" {
		t.Fatalf("%+v applied=%+v", body, applied)
	}
}

func TestPutEmptyCategoryRejected(t *testing.T) {
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Config = config.File{Category: "Bangumi"}
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/config", bytes.NewBufferString(`{"category":""}`))
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 400 {
		t.Fatal(res.Status)
	}
	res.Body.Close()
}

func TestPutBadQbitProbe(t *testing.T) {
	applied := false
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Config = config.File{QbitURL: "http://old", QbitUser: "u", Category: "Bangumi"}
		rt.ProbeQbit = func(string, string, string) error { return http.ErrHandlerTimeout }
		rt.ApplyConfig = func(config.File) { applied = true }
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/config", bytes.NewBufferString(`{"qbitUrl":"http://new"}`))
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 400 || applied {
		t.Fatalf("status=%s applied=%v", res.Status, applied)
	}
	res.Body.Close()
}

func TestPutEmptyPasswordKeepsPrevious(t *testing.T) {
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Config = config.File{Category: "Bangumi", QbitPass: "keep-me", QbitURL: "http://q", QbitUser: "u"}
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/config", bytes.NewBufferString(`{"qbitPass":""}`))
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
	body := decode(t, res)
	if body["hasQbitPass"] != true {
		t.Fatalf("%+v", body)
	}
}

func TestPutProxyURLPersists(t *testing.T) {
	var applied config.File
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Config = config.File{Category: "Bangumi", PollIntervalMs: 600000}
		rt.ApplyConfig = func(file config.File) { applied = file }
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/config", bytes.NewBufferString(`{"proxyUrl":"socks5://127.0.0.1:7891"}`))
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
	if body["proxyUrl"] != "socks5://127.0.0.1:7891" || applied.ProxyURL != "socks5://127.0.0.1:7891" {
		t.Fatalf("%+v applied=%+v", body, applied)
	}
}

func TestPutBadProxyURLRejected(t *testing.T) {
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Config = config.File{Category: "Bangumi"}
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/config", bytes.NewBufferString(`{"proxyUrl":"ftp://127.0.0.1:21"}`))
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 400 {
		t.Fatal(res.Status)
	}
	res.Body.Close()
}

func TestPutVariantPreferPersists(t *testing.T) {
	var applied config.File
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Config = config.File{Category: "Bangumi", PollIntervalMs: 600000}
		rt.ApplyConfig = func(file config.File) { applied = file }
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/config", bytes.NewBufferString(`{"variantPrefer":"tc,sc,internal"}`))
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
	if body["variantPrefer"] != "tc,sc,internal" || applied.VariantPrefer != "tc,sc,internal" {
		t.Fatalf("%+v applied=%+v", body, applied)
	}
}

func TestPutTmdbAPIKeyPersistsHidden(t *testing.T) {
	var applied config.File
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Config = config.File{Category: "Bangumi", PollIntervalMs: 600000}
		rt.ApplyConfig = func(file config.File) { applied = file }
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/config", bytes.NewBufferString(`{"tmdbApiKey":"k"}`))
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
	if body["hasTmdbApiKey"] != true || body["tmdbApiKey"] != nil || applied.TmdbAPIKey != "k" {
		t.Fatalf("%+v applied=%+v", body, applied)
	}
}

func TestPutEmptyTmdbAPIKeyClears(t *testing.T) {
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Config = config.File{Category: "Bangumi", TmdbAPIKey: "k"}
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/config", bytes.NewBufferString(`{"tmdbApiKey":""}`))
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
	if body["hasTmdbApiKey"] != false {
		t.Fatalf("%+v", body)
	}
}

func TestGetConfigHasTmdbApiKeyFromProfile(t *testing.T) {
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Config = config.File{Category: "Bangumi"}
		if _, err := rt.ProfileStore.Apply(0, "desktop", []store.ProfileMutation{{
			Operation: "set", Key: "metadata.tmdb.apiKey", Value: "profile-key", Secret: true,
		}}); err != nil {
			t.Fatal(err)
		}
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/config", nil)
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body := decode(t, res)
	if body["hasTmdbApiKey"] != true || body["tmdbApiKey"] != nil || body["organizeOnComplete"] != false {
		t.Fatalf("%+v", body)
	}
	raw, _ := json.Marshal(body)
	if bytes.Contains(raw, []byte("profile-key")) {
		t.Fatalf("%s", raw)
	}
}

func TestPutOrganizeOnCompletePersists(t *testing.T) {
	var applied config.File
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Config = config.File{Category: "Bangumi", PollIntervalMs: 600000}
		rt.ApplyConfig = func(file config.File) { applied = file }
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/config", bytes.NewBufferString(`{"organizeOnComplete":true}`))
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
	if body["organizeOnComplete"] != true || !applied.OrganizeOnComplete {
		t.Fatalf("%+v applied=%+v", body, applied)
	}
}

func TestPutPartialVariantPreferRejected(t *testing.T) {
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Config = config.File{Category: "Bangumi"}
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/config", bytes.NewBufferString(`{"variantPrefer":"sc"}`))
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 400 {
		t.Fatal(res.Status)
	}
	res.Body.Close()
}
