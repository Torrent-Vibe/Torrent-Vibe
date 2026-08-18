package store

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	OrganizeStatusOK          = "ok"
	OrganizeStatusAlready     = "already"
	OrganizeStatusSkipped     = "skipped"
	OrganizeStatusNeedsManual = "needs-manual"
	OrganizeStatusDeferred    = "deferred"
	OrganizeStatusReady       = "ready"
)

type OrganizedRecord struct {
	Hash           string `json:"hash"`
	Status         string `json:"status"`
	LibraryRelPath string `json:"libraryRelPath,omitempty"`
	TmdbID         int    `json:"tmdbId,omitempty"`
	Reason         string `json:"reason,omitempty"`
	At             string `json:"at,omitempty"`
}

type organizedFile struct {
	Baselined bool              `json:"baselined"`
	Records   []OrganizedRecord `json:"records"`
}

type OrganizedStore struct {
	dataDir string
	mu      sync.Mutex
}

func NewOrganizedStore(dataDir string) *OrganizedStore {
	return &OrganizedStore{dataDir: dataDir}
}

func (s *OrganizedStore) Get(hash string) (OrganizedRecord, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := s.read()
	if err != nil {
		return OrganizedRecord{}, false, err
	}
	record, ok := data.lookup(hash)
	return record, ok, nil
}

func (s *OrganizedStore) Put(record OrganizedRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := s.read()
	if err != nil {
		return err
	}
	data.upsert(record)
	return s.write(data)
}

func (s *OrganizedStore) PutIfAbsent(record OrganizedRecord) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := s.read()
	if err != nil {
		return false, err
	}
	if _, ok := data.lookup(record.Hash); ok {
		return false, nil
	}
	data.upsert(record)
	return true, s.write(data)
}

func (s *OrganizedStore) Baselined() (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := s.read()
	if err != nil {
		return false, err
	}
	return data.Baselined, nil
}

func (s *OrganizedStore) MarkBaselined() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := s.read()
	if err != nil {
		return err
	}
	data.Baselined = true
	return s.write(data)
}

func (s *OrganizedStore) file() string {
	return filepath.Join(s.dataDir, "organized.json")
}

func (s *OrganizedStore) read() (organizedFile, error) {
	raw, err := os.ReadFile(s.file())
	if errors.Is(err, fs.ErrNotExist) {
		return organizedFile{Records: []OrganizedRecord{}}, nil
	}
	if err != nil {
		return organizedFile{}, err
	}
	var data organizedFile
	if err := json.Unmarshal(raw, &data); err != nil {
		return organizedFile{}, err
	}
	if data.Records == nil {
		data.Records = []OrganizedRecord{}
	}
	return data, nil
}

func (s *OrganizedStore) write(data organizedFile) error {
	if err := os.MkdirAll(s.dataDir, 0o755); err != nil {
		return err
	}
	if data.Records == nil {
		data.Records = []OrganizedRecord{}
	}
	raw, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')
	tmp := s.file() + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.file())
}

func (data organizedFile) lookup(hash string) (OrganizedRecord, bool) {
	want := strings.ToLower(strings.TrimSpace(hash))
	for _, record := range data.Records {
		if strings.ToLower(record.Hash) == want {
			return record, true
		}
	}
	return OrganizedRecord{}, false
}

func (data *organizedFile) upsert(record OrganizedRecord) {
	record.Hash = strings.ToLower(strings.TrimSpace(record.Hash))
	if record.At == "" {
		record.At = time.Now().UTC().Format(time.RFC3339Nano)
	}
	for i, existing := range data.Records {
		if strings.ToLower(existing.Hash) == record.Hash {
			data.Records[i] = record
			return
		}
	}
	data.Records = append(data.Records, record)
}
