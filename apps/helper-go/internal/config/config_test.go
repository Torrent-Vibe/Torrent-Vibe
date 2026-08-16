package config_test

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/config"
)

func TestOverlayWinsOverEnv(t *testing.T) {
	dir := t.TempDir()
	if err := config.Save(dir, config.File{
		LibraryRoot: "/from-file", Category: "Bangumi", QbitURL: "http://qb", QbitUser: "u", PollIntervalMs: 1000,
	}); err != nil {
		t.Fatal(err)
	}
	base := config.DefaultsFromEnv(map[string]string{"LIBRARY_ROOT": "/from-env", "QBIT_URL": "http://env"})
	got, err := config.Load(dir, base)
	if err != nil || got.LibraryRoot != "/from-file" {
		t.Fatalf("%+v %v", got, err)
	}
}

func TestPublicOmitsPassword(t *testing.T) {
	p := config.File{QbitPass: "secret", QbitUser: "u"}.Public()
	if !p.HasQbitPass || p.QbitUser != "u" {
		t.Fatalf("%+v", p)
	}
	raw, _ := json.Marshal(p)
	if bytes.Contains(raw, []byte("secret")) || bytes.Contains(raw, []byte("qbitPass")) {
		t.Fatalf("%s", raw)
	}
}

func TestDefaults(t *testing.T) {
	got := config.DefaultsFromEnv(map[string]string{})
	if got.QbitURL != "http://127.0.0.1:8080" || got.QbitUser != "admin" || got.Category != "Bangumi" || got.PollIntervalMs != 600000 {
		t.Fatalf("%+v", got)
	}
}
