package daemon

import (
	"os"
	"path/filepath"
	"strings"
)

func DefaultDataDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".local/share/torrent-vibe-helper"), nil
}

func UnitPath() (string, error) {
	dir, err := userUnitDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "torrent-vibe-helper.service"), nil
}

func InstalledDataDir() string {
	path, err := UnitPath()
	if err != nil {
		return ""
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return DataDirFromUnit(string(raw))
}

func DataDirFromUnit(unit string) string {
	const prefix = "Environment=DATA_DIR="
	for _, line := range strings.Split(unit, "\n") {
		line = strings.TrimSpace(line)
		if after, found := strings.CutPrefix(line, prefix); found {
			return strings.Trim(strings.TrimSpace(after), `"`)
		}
	}
	return ""
}
