package logfile

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"sync"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/redact"
)

const (
	maxSize    = 5 * 1024 * 1024
	maxBackups = 2
	filename   = "helper.log"
)

type writer struct {
	mu       sync.Mutex
	path     string
	registry *redact.Registry
	file     *os.File
	size     int64
	pending  []byte
}

func Path(dataDir string) string {
	return filepath.Join(dataDir, "logs", filename)
}

func Open(dataDir string, r *redact.Registry) (io.Writer, func() error, error) {
	dir := filepath.Join(dataDir, "logs")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, nil, err
	}
	path := Path(dataDir)
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return nil, nil, err
	}
	info, err := f.Stat()
	if err != nil {
		_ = f.Close()
		return nil, nil, err
	}
	w := &writer{path: path, registry: r, file: f, size: info.Size()}
	return w, w.close, nil
}

func (w *writer) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	n := len(p)
	w.pending = append(w.pending, p...)
	for {
		idx := bytes.IndexByte(w.pending, '\n')
		if idx < 0 {
			break
		}
		line := append([]byte(nil), w.pending[:idx+1]...)
		w.pending = w.pending[idx+1:]
		if err := w.writeLine(line); err != nil {
			return n, err
		}
	}
	return n, nil
}

func (w *writer) writeLine(line []byte) error {
	redacted := []byte(w.registry.Apply(string(line)))
	if w.size > 0 && w.size+int64(len(redacted)) > maxSize {
		if err := w.rotate(); err != nil {
			return err
		}
	}
	written, err := w.file.Write(redacted)
	w.size += int64(written)
	return err
}

func (w *writer) rotate() error {
	if err := w.file.Close(); err != nil {
		return err
	}
	_ = os.Remove(backupPath(w.path, maxBackups))
	for i := maxBackups - 1; i >= 1; i-- {
		src := backupPath(w.path, i)
		dst := backupPath(w.path, i+1)
		if _, err := os.Stat(src); err == nil {
			if err := os.Rename(src, dst); err != nil {
				return err
			}
		}
	}
	if err := os.Rename(w.path, backupPath(w.path, 1)); err != nil {
		return err
	}
	f, err := os.OpenFile(w.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	w.file = f
	w.size = 0
	return nil
}

func backupPath(path string, n int) string {
	return path + "." + strconv.Itoa(n)
}

func (w *writer) close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if len(w.pending) > 0 {
		err := w.writeLine(w.pending)
		w.pending = nil
		if err != nil {
			_ = w.file.Close()
			return err
		}
	}
	return w.file.Close()
}
