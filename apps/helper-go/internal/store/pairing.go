package store

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

type Pairing struct {
	Bound bool   `json:"bound"`
	Token string `json:"token"`
}

func pairingPath(dataDir string) string {
	return filepath.Join(dataDir, "pairing.json")
}

func LoadPairing(dataDir string) (Pairing, error) {
	raw, err := os.ReadFile(pairingPath(dataDir))
	if err == nil {
		var pairing Pairing
		if err := json.Unmarshal(raw, &pairing); err != nil {
			return Pairing{}, err
		}
		if pairing.Token == "" {
			return ensurePairing(dataDir, Pairing{Bound: false})
		}
		return pairing, nil
	}
	if !errors.Is(err, fs.ErrNotExist) {
		return Pairing{}, err
	}

	legacy, err := os.ReadFile(filepath.Join(dataDir, "token"))
	if err == nil {
		token := strings.TrimSpace(string(legacy))
		if token != "" {
			pairing := Pairing{Bound: false, Token: token}
			if err := SavePairing(dataDir, pairing); err != nil {
				return Pairing{}, err
			}
			return pairing, nil
		}
	} else if !errors.Is(err, fs.ErrNotExist) {
		return Pairing{}, err
	}

	return ensurePairing(dataDir, Pairing{Bound: false})
}

func SavePairing(dataDir string, pairing Pairing) error {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(pairing, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')
	return os.WriteFile(pairingPath(dataDir), raw, 0o600)
}

func RotateToken(dataDir string) (Pairing, error) {
	token, err := randomToken()
	if err != nil {
		return Pairing{}, err
	}
	pairing := Pairing{Bound: false, Token: token}
	if err := SavePairing(dataDir, pairing); err != nil {
		return Pairing{}, err
	}
	return pairing, nil
}

func ensurePairing(dataDir string, pairing Pairing) (Pairing, error) {
	if pairing.Token == "" {
		token, err := randomToken()
		if err != nil {
			return Pairing{}, err
		}
		pairing.Token = token
	}
	if err := SavePairing(dataDir, pairing); err != nil {
		return Pairing{}, err
	}
	return pairing, nil
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
