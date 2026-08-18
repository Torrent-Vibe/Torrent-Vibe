package store_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

func TestLoadOrCreatePairingCodeIsStableAcrossCalls(t *testing.T) {
	dir := t.TempDir()
	first, err := store.LoadOrCreatePairingCode(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !store.ValidPairingCode(first) {
		t.Fatalf("invalid code %q", first)
	}
	second, err := store.LoadOrCreatePairingCode(dir)
	if err != nil {
		t.Fatal(err)
	}
	if second != first {
		t.Fatalf("code changed: %q -> %q", first, second)
	}
}

func TestPairingCodeFileIsOwnerOnly(t *testing.T) {
	dir := t.TempDir()
	if _, err := store.LoadOrCreatePairingCode(dir); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(store.PairingCodePath(dir))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("mode=%v", info.Mode().Perm())
	}
}

func TestRotatePairingCodeReplacesStoredCode(t *testing.T) {
	dir := t.TempDir()
	first, err := store.LoadOrCreatePairingCode(dir)
	if err != nil {
		t.Fatal(err)
	}
	rotated, err := store.RotatePairingCode(dir)
	if err != nil {
		t.Fatal(err)
	}
	if rotated == first {
		t.Fatalf("rotate returned the same code %q", rotated)
	}
	reloaded, err := store.LoadOrCreatePairingCode(dir)
	if err != nil {
		t.Fatal(err)
	}
	if reloaded != rotated {
		t.Fatalf("want %q got %q", rotated, reloaded)
	}
}

func TestLoadOrCreatePairingCodeReplacesCorruptFile(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(store.PairingCodePath(dir), []byte("nope!!"), 0o600); err != nil {
		t.Fatal(err)
	}
	code, err := store.LoadOrCreatePairingCode(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !store.ValidPairingCode(code) {
		t.Fatalf("invalid code %q", code)
	}
}

func TestReadPairingCodeNormalizesWhitespaceAndCase(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(store.PairingCodePath(dir), []byte(" abc234 \n"), 0o600); err != nil {
		t.Fatal(err)
	}
	code, ok := store.ReadPairingCode(dir)
	if !ok || code != "ABC234" {
		t.Fatalf("ok=%v code=%q", ok, code)
	}
}

func TestValidPairingCodeRejectsAmbiguousCharacters(t *testing.T) {
	for _, code := range []string{"ABC23I", "ABC23O", "ABC2341", "ABC23", "abc234"} {
		if store.ValidPairingCode(code) {
			t.Fatalf("%q should be rejected", code)
		}
	}
}

func TestWritePairingCodeLeavesNoTempFiles(t *testing.T) {
	dir := t.TempDir()
	if _, err := store.LoadOrCreatePairingCode(dir); err != nil {
		t.Fatal(err)
	}
	matches, err := filepath.Glob(filepath.Join(dir, "pairing-code.*"))
	if err != nil {
		t.Fatal(err)
	}
	if len(matches) != 0 {
		t.Fatalf("leftover temp files: %v", matches)
	}
}
