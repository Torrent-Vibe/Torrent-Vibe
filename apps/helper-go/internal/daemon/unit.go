package daemon

import (
	"fmt"
	"strings"
)

type Spec struct {
	Binary      string
	DataDir     string
	Port        int
	LibraryRoot string
	QbitURL     string
	QbitUser    string
	QbitPass    string
	ProxyURL    string
}

func UserUnitFile(spec Spec) string {
	lines := []string{
		"[Unit]",
		"Description=Torrent Vibe helper",
		"After=network-online.target",
		"",
		"[Service]",
		"Type=simple",
		fmt.Sprintf("ExecStart=%s", spec.Binary),
		"Restart=always",
		"RestartSec=3",
	}
	for _, pair := range envPairs(spec) {
		lines = append(lines, "Environment="+pair)
	}
	lines = append(lines,
		"",
		"[Install]",
		"WantedBy=default.target",
		"",
	)
	return strings.Join(lines, "\n")
}

func CronRebootLine(spec Spec) string {
	parts := append(envPairs(spec), spec.Binary)
	return "@reboot " + strings.Join(parts, " ")
}

func envPairs(spec Spec) []string {
	pairs := []string{
		fmt.Sprintf("PORT=%d", spec.Port),
		"DATA_DIR=" + spec.DataDir,
	}
	if spec.LibraryRoot != "" {
		pairs = append(pairs, "LIBRARY_ROOT="+spec.LibraryRoot)
	}
	if spec.QbitURL != "" {
		pairs = append(pairs, "QBIT_URL="+spec.QbitURL)
	}
	if spec.QbitUser != "" {
		pairs = append(pairs, "QBIT_USER="+spec.QbitUser)
	}
	if spec.QbitPass != "" {
		pairs = append(pairs, "QBIT_PASS="+spec.QbitPass)
	}
	if spec.ProxyURL != "" {
		pairs = append(pairs, "PROXY="+spec.ProxyURL)
	}
	return pairs
}
