package events

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var levelRank = map[string]int{
	"debug": 0,
	"info":  1,
	"warn":  2,
	"error": 3,
}

type recorder struct {
	mu        sync.Mutex
	dataDir   string
	sanitizer Sanitizer
	seq       uint64
	ring      []Event
	head      int
	size      int
	lastDay   string
}

func New(dataDir string, sanitizer Sanitizer) Recorder {
	return &recorder{
		dataDir:   dataDir,
		sanitizer: sanitizer,
		ring:      make([]Event, RingCapacity),
	}
}

func (r *recorder) Emit(e Event) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.seq++
	e.Seq = r.seq
	e.At = time.Now().UTC()
	if r.sanitizer != nil {
		e = r.sanitizer(e)
	}

	r.appendToRing(e)
	r.appendToDisk(e)
}

func (r *recorder) Query(q Query) ([]Event, uint64) {
	limit := q.Limit
	if limit <= 0 {
		limit = DefaultQueryLimit
	}
	if limit > MaxQueryLimit {
		limit = MaxQueryLimit
	}
	minRank, filterByLevel := levelRank[q.Level]

	r.mu.Lock()
	defer r.mu.Unlock()

	result := make([]Event, 0, limit)
	truncated := false
	for i := 0; i < r.size; i++ {
		if len(result) >= limit {
			truncated = true
			break
		}
		e := r.ring[(r.head+i)%RingCapacity]
		if e.Seq <= q.Since {
			continue
		}
		if filterByLevel && levelRank[e.Level] < minRank {
			continue
		}
		if q.Kind != "" && e.Kind != q.Kind {
			continue
		}
		if q.ReplicaID != "" && e.ReplicaID != q.ReplicaID {
			continue
		}
		result = append(result, e)
	}
	cursor := r.seq
	if truncated {
		cursor = result[len(result)-1].Seq
	}
	return result, cursor
}

func (r *recorder) appendToRing(e Event) {
	index := (r.head + r.size) % RingCapacity
	r.ring[index] = e
	if r.size < RingCapacity {
		r.size++
	} else {
		r.head = (r.head + 1) % RingCapacity
	}
}

func (r *recorder) appendToDisk(e Event) {
	dir := filepath.Join(r.dataDir, "logs")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return
	}

	day := e.At.Format("20060102")
	if day != r.lastDay {
		pruneOldEventFiles(dir, e.At)
		r.lastDay = day
	}

	data, err := json.Marshal(e)
	if err != nil {
		return
	}
	data = append(data, '\n')

	path := filepath.Join(dir, "events-"+day+".jsonl")
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer f.Close()
	_, _ = f.Write(data)
}

func pruneOldEventFiles(dir string, now time.Time) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	cutoff := now.UTC().Truncate(24*time.Hour).AddDate(0, 0, -RetentionDays)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasPrefix(name, "events-") || !strings.HasSuffix(name, ".jsonl") {
			continue
		}
		dateStr := strings.TrimSuffix(strings.TrimPrefix(name, "events-"), ".jsonl")
		fileDay, err := time.ParseInLocation("20060102", dateStr, time.UTC)
		if err != nil {
			continue
		}
		if fileDay.Before(cutoff) {
			_ = os.Remove(filepath.Join(dir, name))
		}
	}
}
