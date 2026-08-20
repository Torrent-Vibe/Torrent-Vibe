package store

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
)

type Episode struct {
	EpisodeID string                `json:"episodeId"`
	Infohash  string                `json:"infohash,omitempty"`
	Title     string                `json:"title"`
	Season    *int                  `json:"season"`
	Episode   *int                  `json:"episode"`
	Series    string                `json:"series,omitempty"`
	Kind      string                `json:"kind,omitempty"`
	State     protocol.EpisodeState `json:"state"`
	LastError string                `json:"lastError,omitempty"`
}

func EpisodeKey(bangumiID, subgroupID string) string {
	return bangumiID + ":" + subgroupID
}

type ReplicaCheck struct {
	CheckedAt           time.Time `json:"checkedAt"`
	CheckError          string    `json:"checkError,omitempty"`
	ConsecutiveFailures int       `json:"consecutiveFailures"`
}

func cloneReplicas(replicas []protocol.Replica) []protocol.Replica {
	out := make([]protocol.Replica, len(replicas))
	copy(out, replicas)
	return out
}

type persisted struct {
	Revision uint64                  `json:"revision"`
	Replicas []protocol.Replica      `json:"replicas"`
	Episodes map[string][]Episode    `json:"episodes"`
	Checks   map[string]ReplicaCheck `json:"checks"`
}

type ReplicaSnapshot struct {
	Revision uint64
	Replicas []protocol.Replica
}

var ErrRevisionConflict = errors.New("replica revision conflict")

type Store struct {
	dataDir string
	mu      sync.Mutex
}

func New(dataDir string) *Store {
	return &Store{dataDir: dataDir}
}

func (s *Store) file() string {
	return filepath.Join(s.dataDir, "replicas.json")
}

func (s *Store) LoadReplicas() ([]protocol.Replica, error) {
	snapshot, err := s.LoadReplicaSnapshot()
	if err != nil {
		return nil, err
	}
	return snapshot.Replicas, nil
}

func (s *Store) LoadReplicaSnapshot() (ReplicaSnapshot, error) {
	data, err := s.read()
	if err != nil {
		return ReplicaSnapshot{}, err
	}
	return ReplicaSnapshot{
		Revision: data.Revision,
		Replicas: cloneReplicas(data.Replicas),
	}, nil
}

func (s *Store) SaveReplicas(replicas []protocol.Replica) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := s.read()
	if err != nil {
		return err
	}
	data.Revision++
	data.Replicas = replicas
	return s.write(data)
}

func (s *Store) SaveReplicasIfRevision(replicas []protocol.Replica, expected uint64) (ReplicaSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := s.read()
	if err != nil {
		return ReplicaSnapshot{}, err
	}
	if data.Revision != expected {
		return ReplicaSnapshot{
			Revision: data.Revision,
			Replicas: cloneReplicas(data.Replicas),
		}, ErrRevisionConflict
	}
	data.Revision++
	data.Replicas = cloneReplicas(replicas)
	if err := s.write(data); err != nil {
		return ReplicaSnapshot{}, err
	}
	return ReplicaSnapshot{
		Revision: data.Revision,
		Replicas: cloneReplicas(data.Replicas),
	}, nil
}

func (s *Store) LoadEpisodes() (map[string][]Episode, error) {
	data, err := s.read()
	if err != nil {
		return nil, err
	}
	if data.Episodes == nil {
		return map[string][]Episode{}, nil
	}
	return data.Episodes, nil
}

func (s *Store) SaveEpisodes(episodes map[string][]Episode) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := s.read()
	if err != nil {
		return err
	}
	data.Episodes = episodes
	return s.write(data)
}

func (s *Store) LoadReplicaChecks() (map[string]ReplicaCheck, error) {
	data, err := s.read()
	if err != nil {
		return nil, err
	}
	if data.Checks == nil {
		return map[string]ReplicaCheck{}, nil
	}
	return data.Checks, nil
}

func (s *Store) SaveReplicaChecks(checks map[string]ReplicaCheck) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := s.read()
	if err != nil {
		return err
	}
	data.Checks = checks
	return s.write(data)
}

func (s *Store) RecordReplicaCheck(key string, at time.Time, checkErr error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := s.read()
	if err != nil {
		return err
	}
	check := data.Checks[key]
	check.CheckedAt = at
	if checkErr != nil {
		check.ConsecutiveFailures++
		check.CheckError = checkErr.Error()
	} else {
		check.ConsecutiveFailures = 0
		check.CheckError = ""
	}
	data.Checks[key] = check
	return s.write(data)
}

func (s *Store) ClearAll() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := s.read()
	if err != nil {
		return err
	}
	data.Revision++
	data.Replicas = []protocol.Replica{}
	data.Episodes = map[string][]Episode{}
	data.Checks = map[string]ReplicaCheck{}
	return s.write(data)
}

func (s *Store) read() (persisted, error) {
	raw, err := os.ReadFile(s.file())
	if errors.Is(err, fs.ErrNotExist) {
		return persisted{Replicas: []protocol.Replica{}, Episodes: map[string][]Episode{}, Checks: map[string]ReplicaCheck{}}, nil
	}
	if err != nil {
		return persisted{}, err
	}
	var data persisted
	if err := json.Unmarshal(raw, &data); err != nil {
		return persisted{}, err
	}
	if data.Replicas == nil {
		data.Replicas = []protocol.Replica{}
	}
	if data.Episodes == nil {
		data.Episodes = map[string][]Episode{}
	}
	if data.Checks == nil {
		data.Checks = map[string]ReplicaCheck{}
	}
	return data, nil
}

func (s *Store) write(data persisted) error {
	if err := os.MkdirAll(s.dataDir, 0o755); err != nil {
		return err
	}
	if data.Replicas == nil {
		data.Replicas = []protocol.Replica{}
	}
	if data.Episodes == nil {
		data.Episodes = map[string][]Episode{}
	}
	if data.Checks == nil {
		data.Checks = map[string]ReplicaCheck{}
	}
	raw, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return err
	}
	tmp := s.file() + "." + hex.EncodeToString(buf) + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.file())
}
