package httpx_test

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
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

func TestLogsTailLargerThanFileReturnsWholeFileNoPadding(t *testing.T) {
	dir := t.TempDir()
	writeLogLines(t, dir, 10)
	srv := start(t, func(rt *httpx.Runtime) {
		rt.DataDir = dir
	})
	defer srv.Close()

	res := getLogs(t, http.DefaultClient, srv.URL+"/logs?tail=500")
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status=%s", res.Status)
	}
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	want := ""
	for i := 0; i < 10; i++ {
		want += fmt.Sprintf("line%d\n", i)
	}
	if string(raw) != want {
		t.Fatalf("body = %q, want %q", raw, want)
	}
}

func TestLogsPreservesFinalLineWithoutTrailingNewline(t *testing.T) {
	dir := t.TempDir()
	registry := redact.NewRegistry()
	w, closeFn, err := logfile.Open(dir, registry)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 5; i++ {
		if _, err := w.Write([]byte(fmt.Sprintf("line%d\n", i))); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := w.Write([]byte("unterminated-final-line")); err != nil {
		t.Fatal(err)
	}
	if err := closeFn(); err != nil {
		t.Fatal(err)
	}

	srv := start(t, func(rt *httpx.Runtime) {
		rt.DataDir = dir
	})
	defer srv.Close()

	res := getLogs(t, http.DefaultClient, srv.URL+"/logs?tail=2")
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status=%s", res.Status)
	}
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if string(raw) != "line4\nunterminated-final-line" {
		t.Fatalf("body = %q, want the unterminated final line preserved intact", raw)
	}
}

func TestLogsTailAcrossMultipleChunksIsExactAndInOrder(t *testing.T) {
	dir := t.TempDir()
	registry := redact.NewRegistry()
	w, closeFn, err := logfile.Open(dir, registry)
	if err != nil {
		t.Fatal(err)
	}
	const totalLines = 5300
	padding := strings.Repeat("z", 38)
	for i := 0; i < totalLines; i++ {
		if _, err := w.Write([]byte(fmt.Sprintf("line-%05d-%s\n", i, padding))); err != nil {
			t.Fatal(err)
		}
	}
	if err := closeFn(); err != nil {
		t.Fatal(err)
	}

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
	if len(raw) < 3*64*1024 {
		t.Fatalf("fixture too small to exercise multiple 64KB chunk reads: %d bytes", len(raw))
	}
	lines := strings.Split(strings.TrimRight(string(raw), "\n"), "\n")
	const wantCount = 5000
	if len(lines) != wantCount {
		t.Fatalf("got %d lines, want %d (the tail cap)", len(lines), wantCount)
	}
	firstExpected := totalLines - wantCount
	for i, line := range lines {
		want := fmt.Sprintf("line-%05d-%s", firstExpected+i, padding)
		if line != want {
			t.Fatalf("line %d = %q, want %q (seam corruption at a chunk boundary?)", i, line, want)
		}
	}
}

func TestLogsEmptyFileAndMissingFileAreDistinctPathsBothReturn200(t *testing.T) {
	t.Run("missing", func(t *testing.T) {
		dir := t.TempDir()
		if _, err := os.Stat(logfile.Path(dir)); !errors.Is(err, fs.ErrNotExist) {
			t.Fatalf("precondition: expected no log file on disk, stat err=%v", err)
		}
		srv := start(t, func(rt *httpx.Runtime) {
			rt.DataDir = dir
		})
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
	})

	t.Run("empty", func(t *testing.T) {
		dir := t.TempDir()
		if err := os.MkdirAll(filepath.Dir(logfile.Path(dir)), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(logfile.Path(dir), nil, 0o600); err != nil {
			t.Fatal(err)
		}
		if _, err := os.Stat(logfile.Path(dir)); err != nil {
			t.Fatalf("precondition: expected an empty log file on disk, stat err=%v", err)
		}
		srv := start(t, func(rt *httpx.Runtime) {
			rt.DataDir = dir
		})
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
	})
}

func TestLogsSingleLineLargerThanOneChunkIsReturnedIntact(t *testing.T) {
	dir := t.TempDir()
	registry := redact.NewRegistry()
	w, closeFn, err := logfile.Open(dir, registry)
	if err != nil {
		t.Fatal(err)
	}
	var builder strings.Builder
	for i := 0; builder.Len() < 100*1024; i++ {
		builder.WriteString(fmt.Sprintf("%08d", i))
	}
	giant := builder.String()
	if _, err := w.Write([]byte(giant)); err != nil {
		t.Fatal(err)
	}
	if err := closeFn(); err != nil {
		t.Fatal(err)
	}

	srv := start(t, func(rt *httpx.Runtime) {
		rt.DataDir = dir
	})
	defer srv.Close()

	res := getLogs(t, http.DefaultClient, srv.URL+"/logs?tail=500")
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status=%s", res.Status)
	}
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if string(raw) != giant {
		t.Fatalf("body length = %d, want %d (giant unterminated single line corrupted at a chunk seam?)", len(raw), len(giant))
	}
}
