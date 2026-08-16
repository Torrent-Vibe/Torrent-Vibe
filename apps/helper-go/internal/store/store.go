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

type persisted struct {
	Replicas []protocol.Replica    `json:"replicas"`
	Episodes map[string][]Episode  `json:"episodes"`
}

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
	data, err := s.read()
	if err != nil {
		return nil, err
	}
	return data.Replicas, nil
}

func (s *Store) SaveReplicas(replicas []protocol.Replica) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := s.read()
	if err != nil {
		return err
	}
	data.Replicas = replicas
	return s.write(data)
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

func (s *Store) ClearAll() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.write(persisted{Replicas: []protocol.Replica{}, Episodes: map[string][]Episode{}})
}

func (s *Store) read() (persisted, error) {
	raw, err := os.ReadFile(s.file())
	if errors.Is(err, fs.ErrNotExist) {
		return persisted{Replicas: []protocol.Replica{}, Episodes: map[string][]Episode{}}, nil
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
