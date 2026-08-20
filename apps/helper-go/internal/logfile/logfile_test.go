package logfile_test

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/logfile"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/redact"
)

const lineSize = 1000

var testLine = []byte(strings.Repeat("x", lineSize-1) + "\n")

func writeLines(t *testing.T, w io.Writer, count int) {
	t.Helper()
	for i := 0; i < count; i++ {
		if _, err := w.Write(testLine); err != nil {
			t.Fatalf("write line %d: %v", i, err)
		}
	}
}

func TestRotatesAtSizeThreshold(t *testing.T) {
	dir := t.TempDir()
	registry := redact.NewRegistry()
	w, closeFn, err := logfile.Open(dir, registry)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	writeLines(t, w, 5300)

	if err := closeFn(); err != nil {
		t.Fatalf("close: %v", err)
	}

	logsDir := filepath.Join(dir, "logs")
	backupPath := filepath.Join(logsDir, "helper.log.1")
	info, err := os.Stat(backupPath)
	if err != nil {
		t.Fatalf("expected rotation to produce helper.log.1: %v", err)
	}
	if info.Size() == 0 {
		t.Fatal("helper.log.1 is empty, want rotated content")
	}

	currentInfo, err := os.Stat(filepath.Join(logsDir, "helper.log"))
	if err != nil {
		t.Fatalf("expected helper.log to exist: %v", err)
	}

	totalBytes := info.Size() + currentInfo.Size()
	wantBytes := int64(5300 * lineSize)
	if totalBytes != wantBytes {
		t.Fatalf("total bytes across helper.log + helper.log.1 = %d, want %d", totalBytes, wantBytes)
	}
}

func TestKeepsOnlyThreeFilesTotal(t *testing.T) {
	dir := t.TempDir()
	registry := redact.NewRegistry()
	w, closeFn, err := logfile.Open(dir, registry)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	writeLines(t, w, 22000)

	if err := closeFn(); err != nil {
		t.Fatalf("close: %v", err)
	}

	logsDir := filepath.Join(dir, "logs")
	entries, err := os.ReadDir(logsDir)
	if err != nil {
		t.Fatalf("ReadDir: %v", err)
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		names = append(names, entry.Name())
	}
	if len(names) != 3 {
		t.Fatalf("logs dir has %d files %v, want 3", len(names), names)
	}
	for _, want := range []string{"helper.log", "helper.log.1", "helper.log.2"} {
		if _, err := os.Stat(filepath.Join(logsDir, want)); err != nil {
			t.Fatalf("expected %s to exist: %v", want, err)
		}
	}
	if _, err := os.Stat(filepath.Join(logsDir, "helper.log.3")); err == nil {
		t.Fatal("helper.log.3 exists, want at most 3 files kept")
	}
}

func TestPathMatchesWhereOpenWrites(t *testing.T) {
	dir := t.TempDir()
	registry := redact.NewRegistry()
	w, closeFn, err := logfile.Open(dir, registry)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if _, err := w.Write([]byte("hello\n")); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := closeFn(); err != nil {
		t.Fatalf("close: %v", err)
	}

	raw, err := os.ReadFile(logfile.Path(dir))
	if err != nil {
		t.Fatalf("ReadFile(logfile.Path(dir)): %v", err)
	}
	if string(raw) != "hello\n" {
		t.Fatalf("content = %q", raw)
	}
}

func TestSecretRedactedBeforeWrite(t *testing.T) {
	dir := t.TempDir()
	registry := redact.NewRegistry()
	registry.Add("s3cr3t-token-value")

	w, closeFn, err := logfile.Open(dir, registry)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if _, err := w.Write([]byte("qbit login failed with token s3cr3t-token-value\n")); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := closeFn(); err != nil {
		t.Fatalf("close: %v", err)
	}

	raw, err := os.ReadFile(filepath.Join(dir, "logs", "helper.log"))
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if bytes.Contains(raw, []byte("s3cr3t-token-value")) {
		t.Fatalf("log file contains raw secret: %s", raw)
	}
	if !bytes.Contains(raw, []byte("***")) {
		t.Fatalf("log file missing redaction marker: %s", raw)
	}
}
