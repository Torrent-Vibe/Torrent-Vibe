package daemon

import (
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
)

func Install(spec Spec) error {
	if spec.Binary == "" {
		exe, err := os.Executable()
		if err != nil {
			return err
		}
		spec.Binary, err = filepath.EvalSymlinks(exe)
		if err != nil {
			spec.Binary = exe
		}
	}
	if spec.Port <= 0 {
		spec.Port = 17890
	}
	if spec.DataDir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return err
		}
		spec.DataDir = filepath.Join(home, ".local/share/torrent-vibe-helper")
	}
	if err := os.MkdirAll(spec.DataDir, 0o755); err != nil {
		return err
	}

	unitDir, err := userUnitDir()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(unitDir, 0o755); err != nil {
		return err
	}
	unitPath := filepath.Join(unitDir, "torrent-vibe-helper.service")
	if err := os.WriteFile(unitPath, []byte(UserUnitFile(spec)), 0o644); err != nil {
		return err
	}

	if err := runSilent("systemctl", "--user", "daemon-reload"); err != nil {
		return fmt.Errorf("systemctl daemon-reload: %w", err)
	}
	if err := runSilent("systemctl", "--user", "enable", "--now", "torrent-vibe-helper.service"); err != nil {
		return fmt.Errorf("systemctl enable: %w", err)
	}

	linger := enableLinger()
	if !linger {
		if err := ensureCronReboot(spec); err != nil {
			fmt.Fprintf(os.Stderr, "[helper] cron @reboot: %v\n", err)
		}
		startDetached(spec)
		fmt.Fprintln(os.Stderr, "[helper] user linger is off; installed cron @reboot so the helper survives reboot.")
		fmt.Fprintln(os.Stderr, "[helper] run once as root: loginctl enable-linger "+currentUser())
	}

	fmt.Println("[helper] daemon installed:", unitPath)
	return nil
}

func userUnitDir() (string, error) {
	if dir := os.Getenv("XDG_CONFIG_HOME"); dir != "" {
		return filepath.Join(dir, "systemd/user"), nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config/systemd/user"), nil
}

func enableLinger() bool {
	name := currentUser()
	if name == "" {
		return false
	}
	if runSilent("loginctl", "enable-linger", name) == nil {
		return true
	}
	return runSilent("sudo", "-n", "loginctl", "enable-linger", name) == nil
}

func currentUser() string {
	if u, err := user.Current(); err == nil {
		return u.Username
	}
	return os.Getenv("USER")
}

func ensureCronReboot(spec Spec) error {
	line := CronRebootLine(spec)
	raw, _ := exec.Command("crontab", "-l").Output()
	text := string(raw)
	kept := make([]string, 0)
	for _, existing := range strings.Split(text, "\n") {
		if existing == "" || strings.Contains(existing, "torrent-vibe-helper") {
			continue
		}
		kept = append(kept, existing)
	}
	kept = append(kept, line)
	cmd := exec.Command("crontab", "-")
	cmd.Stdin = strings.NewReader(strings.Join(kept, "\n") + "\n")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%w: %s", err, out)
	}
	return nil
}

func startDetached(spec Spec) {
	line := strings.TrimPrefix(CronRebootLine(spec), "@reboot ")
	at := exec.Command("at", "now")
	at.Stdin = strings.NewReader(line + "\n")
	if err := at.Run(); err == nil {
		return
	}
	cmd := exec.Command("sh", "-c", line)
	cmd.Stdout = nil
	cmd.Stderr = nil
	cmd.Stdin = nil
	if err := cmd.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "[helper] start detached: %v\n", err)
		return
	}
	_ = cmd.Process.Release()
}

func runSilent(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout = nil
	cmd.Stderr = nil
	return cmd.Run()
}

func SpecFromEnv() Spec {
	port, _ := strconv.Atoi(os.Getenv("PORT"))
	return Spec{
		DataDir:     os.Getenv("DATA_DIR"),
		Port:        port,
		LibraryRoot: os.Getenv("LIBRARY_ROOT"),
		QbitURL:     os.Getenv("QBIT_URL"),
		QbitUser:    os.Getenv("QBIT_USER"),
		QbitPass:    os.Getenv("QBIT_PASS"),
		ProxyURL: firstNonEmpty(
			os.Getenv("PROXY"),
			os.Getenv("HTTP_PROXY"),
			os.Getenv("HTTPS_PROXY"),
			os.Getenv("ALL_PROXY"),
		),
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
