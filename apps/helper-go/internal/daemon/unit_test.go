package daemon

import (
	"strings"
	"testing"
)

func TestUserUnitFileRestartsAlwaysAndPinsDataDir(t *testing.T) {
	unit := UserUnitFile(Spec{
		Binary:      "/home/innei/.local/bin/torrent-vibe-helper",
		DataDir:     "/home/innei/.local/share/torrent-vibe-helper",
		Port:        17890,
		LibraryRoot: "/mnt/wd1/share/bt",
		QbitURL:     "http://127.0.0.1:18888",
		QbitUser:    "admin",
		ProxyURL:    "socks5://127.0.0.1:7891",
	})
	for _, want := range []string{
		"Restart=always",
		"WantedBy=default.target",
		"ExecStart=/home/innei/.local/bin/torrent-vibe-helper",
		"Environment=DATA_DIR=/home/innei/.local/share/torrent-vibe-helper",
		"Environment=LIBRARY_ROOT=/mnt/wd1/share/bt",
		"Environment=QBIT_URL=http://127.0.0.1:18888",
		"Environment=PORT=17890",
		"Environment=PROXY=socks5://127.0.0.1:7891",
	} {
		if !strings.Contains(unit, want) {
			t.Fatalf("missing %q in\n%s", want, unit)
		}
	}
}

func TestCronRebootLineRunsBinaryWithEnv(t *testing.T) {
	line := CronRebootLine(Spec{
		Binary:      "/home/innei/.local/bin/torrent-vibe-helper",
		DataDir:     "/home/innei/.local/share/torrent-vibe-helper",
		Port:        17890,
		LibraryRoot: "/mnt/wd1/share/bt",
		QbitURL:     "http://127.0.0.1:18888",
		QbitUser:    "admin",
	})
	if !strings.HasPrefix(line, "@reboot ") {
		t.Fatalf("%q", line)
	}
	for _, want := range []string{
		"DATA_DIR=/home/innei/.local/share/torrent-vibe-helper",
		"/home/innei/.local/bin/torrent-vibe-helper",
		"QBIT_URL=http://127.0.0.1:18888",
	} {
		if !strings.Contains(line, want) {
			t.Fatalf("missing %q in %q", want, line)
		}
	}
}

func TestDataDirFromUnitReadsEnvironmentLine(t *testing.T) {
	unit := UserUnitFile(Spec{
		Binary:  "/home/user/.local/bin/torrent-vibe-helper",
		DataDir: "/home/user/.local/share/torrent-vibe-helper",
		Port:    17890,
	})
	if got := DataDirFromUnit(unit); got != "/home/user/.local/share/torrent-vibe-helper" {
		t.Fatalf("got %q", got)
	}
}

func TestDataDirFromUnitReturnsEmptyWhenAbsent(t *testing.T) {
	if got := DataDirFromUnit("[Service]\nExecStart=/bin/true\n"); got != "" {
		t.Fatalf("got %q", got)
	}
}
