package httpx_test

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/httpx"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/logfile"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/redact"
)

func getLogs(t *testing.T, srv *http.Client, url string) *http.Response {
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
	return res
}

func TestLogsRequiresBearer(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	res, err := http.Get(srv.URL + "/logs")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status=%s", res.Status)
	}
}

func TestLogsMissingFileReturns200EmptyBody(t *testing.T) {
	srv := start(t)
	defer srv.Close()
	res := getLogs(t, http.DefaultClient, srv.URL+"/logs")
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status=%s", res.Status)
	}
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if len(raw) != 0 {
		t.Fatalf("body = %q, want empty", raw)
	}
}

func writeLogLines(t *testing.T, dir string, count int) {
	t.Helper()
	registry := redact.NewRegistry()
	w, closeFn, err := logfile.Open(dir, registry)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < count; i++ {
		if _, err := w.Write([]byte(fmt.Sprintf("line%d\n", i))); err != nil {
			t.Fatal(err)
		}
	}
	if err := closeFn(); err != nil {
		t.Fatal(err)
	}
}

func TestLogsReturnsLastNLines(t *testing.T) {
	dir := t.TempDir()
	writeLogLines(t, dir, 10)
	srv := start(t, func(rt *httpx.Runtime) {
		rt.DataDir = dir
	})
	defer srv.Close()

	res := getLogs(t, http.DefaultClient, srv.URL+"/logs?tail=3")
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status=%s", res.Status)
	}
	if ct := res.Header.Get("content-type"); ct != "text/plain; charset=utf-8" {
		t.Fatalf("content-type = %q", ct)
	}
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if string(raw) != "line7\nline8\nline9\n" {
		t.Fatalf("body = %q", raw)
	}
}

func TestLogsTailDefaultsWhenAbsentOrInvalid(t *testing.T) {
	dir := t.TempDir()
	writeLogLines(t, dir, 510)
	srv := start(t, func(rt *httpx.Runtime) {
		rt.DataDir = dir
	})
	defer srv.Close()

	for _, query := range []string{"/logs", "/logs?tail=notanumber", "/logs?tail=-5"} {
		res := getLogs(t, http.DefaultClient, srv.URL+query)
		raw, err := io.ReadAll(res.Body)
		res.Body.Close()
		if err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != http.StatusOK {
			t.Fatalf("%s: status=%s", query, res.Status)
		}
		lines := strings.Split(strings.TrimRight(string(raw), "\n"), "\n")
		if len(lines) != 500 {
			t.Fatalf("%s: got %d lines, want default 500", query, len(lines))
		}
		if lines[0] != "line10" || lines[len(lines)-1] != "line509" {
			t.Fatalf("%s: first=%q last=%q", query, lines[0], lines[len(lines)-1])
		}
	}
}

func TestLogsTailCapsAt5000(t *testing.T) {
	dir := t.TempDir()
	writeLogLines(t, dir, 5010)
	srv := start(t, func(rt *httpx.Runtime) {
		rt.DataDir = dir
	})
	defer srv.Close()

	res := getLogs(t, http.DefaultClient, srv.URL+"/logs?tail=999999")
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status=%s", res.Status)
	}
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimRight(string(raw), "\n"), "\n")
	if len(lines) != 5000 {
		t.Fatalf("got %d lines, want capped at 5000", len(lines))
	}
	if lines[0] != "line10" || lines[len(lines)-1] != "line5009" {
		t.Fatalf("first=%q last=%q", lines[0], lines[len(lines)-1])
	}
}
