package store

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	pairingVersion = 2
	legacyClientID = "legacy-desktop"
)

type ClientCredential struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	TokenHash string `json:"tokenHash"`
	CreatedAt string `json:"createdAt"`
}

type Pairing struct {
	Version int                `json:"version"`
	Clients []ClientCredential `json:"clients"`
}

type legacyPairing struct {
	Bound bool   `json:"bound"`
	Token string `json:"token"`
}

type PairingStore struct {
	dataDir string
	mu      sync.RWMutex
	state   Pairing
}

func OpenPairingStore(dataDir string) (*PairingStore, error) {
	state, err := loadPairing(dataDir)
	if err != nil {
		return nil, err
	}
	return &PairingStore{dataDir: dataDir, state: state}, nil
}

func (s *PairingStore) ClientCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.state.Clients)
}

func (s *PairingStore) Clients() []ClientCredential {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]ClientCredential(nil), s.state.Clients...)
}

func (s *PairingStore) Pair(clientID, clientName string) (string, error) {
	clientID = strings.TrimSpace(clientID)
	clientName = strings.TrimSpace(clientName)
	if clientID == "" || len(clientID) > 128 {
		return "", errors.New("invalid client id")
	}
	if clientName == "" {
		clientName = "Torrent Vibe Client"
	}
	if len(clientName) > 128 {
		return "", errors.New("invalid client name")
	}
	token, err := randomToken()
	if err != nil {
		return "", err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	next := append([]ClientCredential(nil), s.state.Clients...)
	credential := ClientCredential{
		ID:        clientID,
		Name:      clientName,
		TokenHash: tokenHash(token),
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	replaced := false
	for index, client := range next {
		if client.ID == clientID {
			next[index] = credential
			replaced = true
			break
		}
	}
	if !replaced {
		next = append(next, credential)
	}
	state := Pairing{Version: pairingVersion, Clients: next}
	if err := savePairing(s.dataDir, state); err != nil {
		return "", err
	}
	s.state = state
	return token, nil
}

func (s *PairingStore) Authenticate(token string) (ClientCredential, bool) {
	if token == "" {
		return ClientCredential{}, false
	}
	got := []byte(tokenHash(token))
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, client := range s.state.Clients {
		expected := []byte(client.TokenHash)
		if len(got) == len(expected) && subtle.ConstantTimeCompare(got, expected) == 1 {
			return client, true
		}
	}
	return ClientCredential{}, false
}

func (s *PairingStore) Revoke(clientID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	next := make([]ClientCredential, 0, len(s.state.Clients))
	for _, client := range s.state.Clients {
		if client.ID != clientID {
			next = append(next, client)
		}
	}
	state := Pairing{Version: pairingVersion, Clients: next}
	if err := savePairing(s.dataDir, state); err != nil {
		return err
	}
	s.state = state
	return nil
}

func pairingPath(dataDir string) string {
	return filepath.Join(dataDir, "pairing.json")
}

func loadPairing(dataDir string) (Pairing, error) {
	raw, err := os.ReadFile(pairingPath(dataDir))
	if err == nil {
		var current Pairing
		if json.Unmarshal(raw, &current) == nil && current.Version >= pairingVersion {
			if current.Clients == nil {
				current.Clients = []ClientCredential{}
			}
			_ = os.Remove(filepath.Join(dataDir, "token"))
			return current, nil
		}

		var legacy legacyPairing
		if err := json.Unmarshal(raw, &legacy); err != nil {
			return Pairing{}, err
		}
		migrated := Pairing{Version: pairingVersion, Clients: []ClientCredential{}}
		if legacy.Bound && strings.TrimSpace(legacy.Token) != "" {
			migrated.Clients = append(migrated.Clients, ClientCredential{
				ID:        legacyClientID,
				Name:      "Legacy Torrent Vibe Desktop",
				TokenHash: tokenHash(strings.TrimSpace(legacy.Token)),
				CreatedAt: time.Now().UTC().Format(time.RFC3339),
			})
		}
		if err := savePairing(dataDir, migrated); err != nil {
			return Pairing{}, err
		}
		_ = os.Remove(filepath.Join(dataDir, "token"))
		return migrated, nil
	}
	if !errors.Is(err, fs.ErrNotExist) {
		return Pairing{}, err
	}

	empty := Pairing{Version: pairingVersion, Clients: []ClientCredential{}}
	if err := savePairing(dataDir, empty); err != nil {
		return Pairing{}, err
	}
	_ = os.Remove(filepath.Join(dataDir, "token"))
	return empty, nil
}

func savePairing(dataDir string, pairing Pairing) error {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(pairing, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')
	tmp := pairingPath(dataDir) + fmt.Sprintf(".%d.tmp", time.Now().UnixNano())
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, pairingPath(dataDir))
}

func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func randomToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

const pairingAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func GeneratePairingCode() (string, error) {
	buf := make([]byte, 6)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	out := make([]byte, 6)
	for i, b := range buf {
		out[i] = pairingAlphabet[int(b)%len(pairingAlphabet)]
	}
	return string(out), nil
}
