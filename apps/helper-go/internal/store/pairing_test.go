package store_test

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

func TestLoadPairingGeneratesTokenUnbound(t *testing.T) {
	p, err := store.LoadPairing(t.TempDir())
	if err != nil || p.Bound || len(p.Token) < 32 {
		t.Fatalf("%+v %v", p, err)
	}
}

func TestLoadPairingMigratesLegacyTokenUnbound(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "token"), []byte("legacy-token\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	p, err := store.LoadPairing(dir)
	if err != nil || p.Bound || p.Token != "legacy-token" {
		t.Fatalf("%+v %v", p, err)
	}
	raw, _ := os.ReadFile(filepath.Join(dir, "pairing.json"))
	if !bytes.Contains(raw, []byte("legacy-token")) {
		t.Fatalf("%s", raw)
	}
}

func TestGeneratePairingCode(t *testing.T) {
	code, err := store.GeneratePairingCode()
	if err != nil || len(code) != 6 {
		t.Fatalf("%q %v", code, err)
	}
	for _, r := range code {
		if !strings.ContainsRune("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r) {
			t.Fatalf("%q", code)
		}
	}
}

func TestRotateTokenClearsBound(t *testing.T) {
	dir := t.TempDir()
	first, _ := store.LoadPairing(dir)
	_ = store.SavePairing(dir, store.Pairing{Bound: true, Token: first.Token})
	next, err := store.RotateToken(dir)
	if err != nil || next.Bound || next.Token == first.Token {
		t.Fatalf("%+v %v", next, err)
	}
}
