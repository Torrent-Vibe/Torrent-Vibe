package store

import (
	"crypto/rand"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	pairingAlphabet   = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	pairingCodeLength = 6
)

func PairingCodePath(dataDir string) string {
	return filepath.Join(dataDir, "pairing-code")
}

func LoadOrCreatePairingCode(dataDir string) (string, error) {
	if code, ok := ReadPairingCode(dataDir); ok {
		return code, nil
	}
	return RotatePairingCode(dataDir)
}

func RotatePairingCode(dataDir string) (string, error) {
	code, err := GeneratePairingCode()
	if err != nil {
		return "", err
	}
	if err := WritePairingCode(dataDir, code); err != nil {
		return "", err
	}
	return code, nil
}

func ReadPairingCode(dataDir string) (string, bool) {
	raw, err := os.ReadFile(PairingCodePath(dataDir))
	if err != nil {
		return "", false
	}
	code := strings.ToUpper(strings.TrimSpace(string(raw)))
	if !ValidPairingCode(code) {
		return "", false
	}
	return code, true
}

func WritePairingCode(dataDir, code string) error {
	if !ValidPairingCode(code) {
		return fmt.Errorf("invalid pairing code")
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return err
	}
	path := PairingCodePath(dataDir)
	tmp := path + fmt.Sprintf(".%d.tmp", time.Now().UnixNano())
	if err := os.WriteFile(tmp, []byte(code+"\n"), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func ValidPairingCode(code string) bool {
	if len(code) != pairingCodeLength {
		return false
	}
	for _, char := range code {
		if !strings.ContainsRune(pairingAlphabet, char) {
			return false
		}
	}
	return true
}

func GeneratePairingCode() (string, error) {
	buf := make([]byte, pairingCodeLength)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	out := make([]byte, pairingCodeLength)
	for i, b := range buf {
		out[i] = pairingAlphabet[int(b)%len(pairingAlphabet)]
	}
	return string(out), nil
}
