package store

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
)

const (
	maxProfileKeyLength   = 128
	maxProfileRecordCount = 256
	maxProfileValueLength = 16 * 1024
)

var (
	ErrInvalidProfileMutation  = errors.New("invalid profile mutation")
	ErrProfileRevisionConflict = errors.New("profile revision conflict")
)

type ProfileRecord struct {
	Key       string `json:"key"`
	Value     string `json:"value"`
	Secret    bool   `json:"secret"`
	UpdatedAt string `json:"updatedAt"`
	UpdatedBy string `json:"updatedBy"`
}

type ProfileSnapshot struct {
	Revision uint64          `json:"revision"`
	Records  []ProfileRecord `json:"records"`
}

type ProfileMutation struct {
	Operation string `json:"operation"`
	Key       string `json:"key"`
	Value     string `json:"value,omitempty"`
	Secret    bool   `json:"secret,omitempty"`
}

type ProfileStore struct {
	dataDir string
	mu      sync.Mutex
}

func NewProfileStore(dataDir string) *ProfileStore {
	return &ProfileStore{dataDir: dataDir}
}

func (s *ProfileStore) Load() (ProfileSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.read()
}

func (s *ProfileStore) Apply(
	expectedRevision uint64,
	updatedBy string,
	mutations []ProfileMutation,
) (ProfileSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	current, err := s.read()
	if err != nil {
		return ProfileSnapshot{}, err
	}
	if current.Revision != expectedRevision {
		return current, ErrProfileRevisionConflict
	}
	if len(mutations) == 0 || len(mutations) > maxProfileRecordCount {
		return current, ErrInvalidProfileMutation
	}

	records := make(map[string]ProfileRecord, len(current.Records))
	for _, record := range current.Records {
		records[record.Key] = record
	}
	updatedAt := time.Now().UTC().Format(time.RFC3339Nano)
	updatedBy = strings.TrimSpace(updatedBy)

	for _, mutation := range mutations {
		key := strings.TrimSpace(mutation.Key)
		if !validProfileKey(key) {
			return current, ErrInvalidProfileMutation
		}
		switch mutation.Operation {
		case "set":
			if len(mutation.Value) > maxProfileValueLength {
				return current, ErrInvalidProfileMutation
			}
			records[key] = ProfileRecord{
				Key:       key,
				Value:     mutation.Value,
				Secret:    mutation.Secret,
				UpdatedAt: updatedAt,
				UpdatedBy: updatedBy,
			}
		case "delete":
			delete(records, key)
		default:
			return current, ErrInvalidProfileMutation
		}
	}
	if len(records) > maxProfileRecordCount {
		return current, ErrInvalidProfileMutation
	}

	next := ProfileSnapshot{
		Revision: current.Revision + 1,
		Records:  make([]ProfileRecord, 0, len(records)),
	}
	for _, record := range records {
		next.Records = append(next.Records, record)
	}
	sort.Slice(next.Records, func(i, j int) bool {
		return next.Records[i].Key < next.Records[j].Key
	})
	if err := s.write(next); err != nil {
		return current, err
	}
	return next, nil
}

func validProfileKey(value string) bool {
	if value == "" || len(value) > maxProfileKeyLength {
		return false
	}
	for _, char := range value {
		if unicode.IsLetter(char) || unicode.IsDigit(char) || char == '.' || char == '-' || char == '_' {
			continue
		}
		return false
	}
	return true
}

func (s *ProfileStore) file() string {
	return filepath.Join(s.dataDir, "profile.json")
}

func (s *ProfileStore) read() (ProfileSnapshot, error) {
	raw, err := os.ReadFile(s.file())
	if errors.Is(err, fs.ErrNotExist) {
		return ProfileSnapshot{Records: []ProfileRecord{}}, nil
	}
	if err != nil {
		return ProfileSnapshot{}, err
	}
	var snapshot ProfileSnapshot
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		return ProfileSnapshot{}, err
	}
	if snapshot.Records == nil {
		snapshot.Records = []ProfileRecord{}
	}
	return snapshot, nil
}

func (s *ProfileStore) write(snapshot ProfileSnapshot) error {
	if err := os.MkdirAll(s.dataDir, 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')
	temporary, err := os.CreateTemp(s.dataDir, "profile.json.*.tmp")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if err := temporary.Chmod(0o600); err != nil {
		temporary.Close()
		return err
	}
	if _, err := temporary.Write(raw); err != nil {
		temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	return os.Rename(temporaryPath, s.file())
}
