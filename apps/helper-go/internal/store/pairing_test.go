package store_test

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

func TestPairingStorePairsIndependentClients(t *testing.T) {
	dir := t.TempDir()
	pairings, err := store.OpenPairingStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	desktopToken, err := pairings.Pair("desktop", "Desktop")
	if err != nil {
		t.Fatal(err)
	}
	iosToken, err := pairings.Pair("ios", "iPhone")
	if err != nil {
		t.Fatal(err)
	}
	if pairings.ClientCount() != 2 {
		t.Fatalf("clients=%d", pairings.ClientCount())
	}
	if client, ok := pairings.Authenticate(desktopToken); !ok || client.ID != "desktop" {
		t.Fatalf("desktop=%+v ok=%v", client, ok)
	}
	if client, ok := pairings.Authenticate(iosToken); !ok || client.ID != "ios" {
		t.Fatalf("ios=%+v ok=%v", client, ok)
	}
	if err := pairings.Revoke("ios"); err != nil {
		t.Fatal(err)
	}
	if _, ok := pairings.Authenticate(iosToken); ok {
		t.Fatal("revoked token still authenticates")
	}
	if _, ok := pairings.Authenticate(desktopToken); !ok {
		t.Fatal("desktop token was revoked with iOS")
	}
}

func TestPairingStoreMigratesBoundLegacyTokenAsHashedClient(t *testing.T) {
	dir := t.TempDir()
	legacyToken := "legacy-token"
	if err := os.WriteFile(
		filepath.Join(dir, "pairing.json"),
		[]byte(`{"bound":true,"token":"legacy-token"}`),
		0o600,
	); err != nil {
		t.Fatal(err)
	}
	pairings, err := store.OpenPairingStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	client, ok := pairings.Authenticate(legacyToken)
	if !ok || client.ID == "" {
		t.Fatalf("client=%+v ok=%v", client, ok)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "pairing.json"))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(raw, []byte(legacyToken)) || bytes.Contains(raw, []byte(`"token"`)) {
		t.Fatalf("plaintext token survived migration: %s", raw)
	}
	if !bytes.Contains(raw, []byte(`"version": 2`)) || !bytes.Contains(raw, []byte(`"tokenHash"`)) {
		t.Fatalf("invalid v2 pairing: %s", raw)
	}
}

func TestPairingStoreDoesNotAuthorizeLegacyUnboundToken(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(
		filepath.Join(dir, "pairing.json"),
		[]byte(`{"bound":false,"token":"unused-token"}`),
		0o600,
	); err != nil {
		t.Fatal(err)
	}
	pairings, err := store.OpenPairingStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if pairings.ClientCount() != 0 {
		t.Fatalf("clients=%d", pairings.ClientCount())
	}
	if _, ok := pairings.Authenticate("unused-token"); ok {
		t.Fatal("unbound legacy token was authorized")
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
