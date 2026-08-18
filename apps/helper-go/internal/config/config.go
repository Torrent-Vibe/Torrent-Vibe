package config

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
)

type File struct {
	LibraryRoot    string `json:"libraryRoot"`
	Category       string `json:"category"`
	QbitURL        string `json:"qbitUrl"`
	QbitUser       string `json:"qbitUser"`
	QbitPass       string `json:"qbitPass"`
	PollIntervalMs int    `json:"pollIntervalMs"`
	ProxyURL       string `json:"proxyUrl"`
	VariantPrefer      string `json:"variantPrefer"`
	TmdbAPIKey         string `json:"tmdbApiKey"`
	OrganizeOnComplete bool   `json:"organizeOnComplete"`
}

type Public struct {
	LibraryRoot    string `json:"libraryRoot"`
	Category       string `json:"category"`
	QbitURL        string `json:"qbitUrl"`
	QbitUser       string `json:"qbitUser"`
	HasQbitPass    bool   `json:"hasQbitPass"`
	PollIntervalMs int    `json:"pollIntervalMs"`
	ProxyURL       string `json:"proxyUrl"`
	VariantPrefer      string `json:"variantPrefer"`
	HasTmdbAPIKey      bool   `json:"hasTmdbApiKey"`
	OrganizeOnComplete bool   `json:"organizeOnComplete"`
}

func (f File) Public() Public {
	return Public{
		LibraryRoot:    f.LibraryRoot,
		Category:       f.Category,
		QbitURL:        f.QbitURL,
		QbitUser:       f.QbitUser,
		HasQbitPass:    f.QbitPass != "",
		PollIntervalMs: f.PollIntervalMs,
		ProxyURL:       f.ProxyURL,
		VariantPrefer:      mikan.EffectiveVariantPrefer(f.VariantPrefer),
		HasTmdbAPIKey:      f.TmdbAPIKey != "",
		OrganizeOnComplete: f.OrganizeOnComplete,
	}
}

func DefaultsFromEnv(env map[string]string) File {
	get := func(key, fallback string) string {
		if env != nil {
			if value, ok := env[key]; ok {
				return value
			}
		}
		return fallback
	}
	poll := 600000
	if raw := get("POLL_INTERVAL_MS", ""); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			poll = n
		}
	}
	proxy := firstNonEmpty(
		get("PROXY", ""),
		get("HTTP_PROXY", ""),
		get("HTTPS_PROXY", ""),
		get("ALL_PROXY", ""),
		get("http_proxy", ""),
		get("https_proxy", ""),
		get("all_proxy", ""),
	)
	return File{
		LibraryRoot:    get("LIBRARY_ROOT", ""),
		Category:       "Bangumi",
		QbitURL:        get("QBIT_URL", "http://127.0.0.1:8080"),
		QbitUser:       get("QBIT_USER", "admin"),
		QbitPass:       get("QBIT_PASS", ""),
		PollIntervalMs: poll,
		ProxyURL:       proxy,
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func Load(dataDir string, base File) (File, error) {
	raw, err := os.ReadFile(filepath.Join(dataDir, "config.json"))
	if errors.Is(err, fs.ErrNotExist) {
		return base, nil
	}
	if err != nil {
		return File{}, err
	}
	overlay := base
	if err := json.Unmarshal(raw, &overlay); err != nil {
		return File{}, err
	}
	return overlay, nil
}

func Save(dataDir string, file File) error {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(file, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')
	return os.WriteFile(filepath.Join(dataDir, "config.json"), raw, 0o600)
}
