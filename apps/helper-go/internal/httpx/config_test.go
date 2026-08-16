package httpx_test

import (
	"bytes"
	"net/http"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/config"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/httpx"
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
