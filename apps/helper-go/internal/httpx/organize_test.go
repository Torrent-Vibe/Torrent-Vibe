package httpx_test

import (
	"bytes"
	"net/http"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/httpx"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/organize"
)

func TestOrganizeRequiresAuth(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	res, err := http.Get(srv.URL + "/organize?hash=abc")
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 401 {
		t.Fatal(res.Status)
	}
	res.Body.Close()
}

func TestGetAndPostOrganize(t *testing.T) {
	srv := start(t, func(rt *httpx.Runtime) {
		rt.OnOrganizePlan = func(hash string) organize.Result {
			return organize.Result{Hash: hash, Status: organize.StatusReady, LibraryRelPath: "Movies/Title (1999)/Title (1999).mkv"}
		}
		rt.OnOrganizeApply = func(hash string) organize.Result {
			return organize.Result{Hash: hash, Status: organize.StatusOK, LibraryRelPath: "Movies/Title (1999)/Title (1999).mkv", Dest: "/lib/Movies/Title (1999)/Title (1999).mkv"}
		}
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/organize?hash=AA", nil)
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body := decode(t, res)
	if body["status"] != "ready" || body["hash"] != "aa" && body["libraryRelPath"] == nil {
		t.Fatalf("%+v", body)
	}

	req, _ = http.NewRequest(http.MethodPost, srv.URL+"/organize", bytes.NewBufferString(`{"hash":"AA"}`))
	req.Header.Set("authorization", "Bearer "+token)
	req.Header.Set("content-type", "application/json")
	res, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body = decode(t, res)
	if body["status"] != "ok" || body["dest"] == nil {
		t.Fatalf("%+v", body)
	}
}

func TestPostOrganizeRejectsEmptyHash(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/organize", bytes.NewBufferString(`{}`))
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
