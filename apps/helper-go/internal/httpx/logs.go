package httpx

import (
	"errors"
	"io"
	"io/fs"
	"net/http"
	"os"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/logfile"
)

const (
	defaultLogTail = 500
	maxLogTail     = 5000
	tailChunkSize  = 64 * 1024
)

func (rt *Runtime) getLogs(w http.ResponseWriter, r *http.Request) {
	tail := queryInt(r, "tail")
	if tail <= 0 {
		tail = defaultLogTail
	}
	if tail > maxLogTail {
		tail = maxLogTail
	}

	data, err := tailFile(logfile.Path(rt.DataDir), tail)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	w.Header().Set("content-type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func tailFile(path string, n int) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return nil, err
	}
	size := info.Size()
	if size == 0 {
		return nil, nil
	}

	pos := size
	buf := make([]byte, 0, tailChunkSize)
	for pos > 0 {
		readSize := int64(tailChunkSize)
		if readSize > pos {
			readSize = pos
		}
		pos -= readSize
		chunk := make([]byte, readSize)
		if _, err := f.ReadAt(chunk, pos); err != nil && !errors.Is(err, io.EOF) {
			return nil, err
		}
		buf = append(chunk, buf...)
		if cut, ok := cutForTailLines(buf, n); ok {
			return buf[cut:], nil
		}
	}
	return buf, nil
}

func cutForTailLines(data []byte, n int) (int, bool) {
	end := len(data)
	if end > 0 && data[end-1] == '\n' {
		end--
	}
	found := 0
	for i := end - 1; i >= 0; i-- {
		if data[i] != '\n' {
			continue
		}
		found++
		if found == n {
			return i + 1, true
		}
	}
	return 0, false
}
