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
	if got.QbitURL != "http://127.0.0.1:8080" || got.QbitUser != "admin" || got.Category != "Bangumi" || got.PollIntervalMs != 600000 || got.ProxyURL != "" {
		t.Fatalf("%+v", got)
	}
}

func TestDefaultsProxyPrefersPROXYThenHTTPProxy(t *testing.T) {
	got := config.DefaultsFromEnv(map[string]string{
		"HTTP_PROXY": "http://env-http:1",
		"PROXY":      "socks5://127.0.0.1:7891",
	})
	if got.ProxyURL != "socks5://127.0.0.1:7891" {
		t.Fatalf("%+v", got)
	}
	got = config.DefaultsFromEnv(map[string]string{"HTTPS_PROXY": "http://only-https:1"})
	if got.ProxyURL != "http://only-https:1" {
		t.Fatalf("%+v", got)
	}
}

func TestPublicVariantPreferDefaults(t *testing.T) {
	p := config.File{}.Public()
	if p.VariantPrefer != "internal,sc,tc" {
		t.Fatalf("%+v", p)
	}
	p = config.File{VariantPrefer: "tc,sc,internal"}.Public()
	if p.VariantPrefer != "tc,sc,internal" {
		t.Fatalf("%+v", p)
	}
	p = config.File{VariantPrefer: "sc"}.Public()
	if p.VariantPrefer != "internal,sc,tc" {
		t.Fatalf("%+v", p)
	}
}

func TestPublicTmdbKeyHidden(t *testing.T) {
	p := config.File{TmdbAPIKey: "secret-key"}.Public()
	if !p.HasTmdbAPIKey {
		t.Fatalf("%+v", p)
	}
	raw, _ := json.Marshal(p)
	if bytes.Contains(raw, []byte("secret-key")) || bytes.Contains(raw, []byte("tmdbApiKey")) {
		t.Fatalf("%s", raw)
	}
}
