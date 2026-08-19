package httpx_test

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/events"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/httpx"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/logfile"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/redact"
)

func TestAuthedRegistersPresentedTokenForRedaction(t *testing.T) {
	registry := redact.NewRegistry()
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Redact = registry
	})
	defer srv.Close()

	before := registry.Apply("prefix " + token + " suffix")
	if !strings.Contains(before, token) {
		t.Fatalf("token unexpectedly already redacted before any request: %q", before)
	}

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/subscriptions", nil)
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status=%s", res.Status)
	}

	after := registry.Apply("prefix " + token + " suffix")
	if strings.Contains(after, token) {
		t.Fatalf("token not registered for redaction after successful auth: %q", after)
	}
}

func TestAuthedDoesNotRegisterTokenOnFailedAuth(t *testing.T) {
	registry := redact.NewRegistry()
	srv := start(t, func(rt *httpx.Runtime) {
		rt.Redact = registry
	})
	defer srv.Close()

	wrongToken := "wrong-token"
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/subscriptions", nil)
	req.Header.Set("authorization", "Bearer "+wrongToken)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status=%s", res.Status)
	}

	got := registry.Apply("prefix " + wrongToken + " suffix")
	if !strings.Contains(got, wrongToken) {
		t.Fatalf("failed-auth token should not be registered: %q", got)
	}
}

func TestEventsAndLogsNeverLeakSecrets(t *testing.T) {
	dataDir := t.TempDir()
	registry := redact.NewRegistry()
	qbitPass := "s3cret-qbit-password"
	registry.Add(qbitPass)
	registry.Add(pairingCode)

	rec := events.New(dataDir, redact.Sanitizer(registry))
	logWriter, closeLog, err := logfile.Open(dataDir, registry)
	if err != nil {
		t.Fatal(err)
	}
	defer closeLog()

	srv := start(t, func(rt *httpx.Runtime) {
		rt.DataDir = dataDir
		rt.Events = rec
		rt.Redact = registry
	})
	defer srv.Close()

	warmup, _ := http.NewRequest(http.MethodGet, srv.URL+"/subscriptions", nil)
	warmup.Header.Set("authorization", "Bearer "+token)
	warmupRes, err := http.DefaultClient.Do(warmup)
	if err != nil {
		t.Fatal(err)
	}
	warmupRes.Body.Close()
	if warmupRes.StatusCode != http.StatusOK {
		t.Fatalf("warmup status=%s", warmupRes.Status)
	}

	rec.Emit(events.Event{
		Level:   "error",
		Kind:    "rss.fetch",
		Message: "fetch failed using qbit pass " + qbitPass,
		Fields: map[string]any{
			"url":   "https://example.com?token=" + token,
			"error": "auth failed with pairing code " + pairingCode,
		},
	})
	if _, err := logWriter.Write([]byte(
		"qbit login failed pass=" + qbitPass + " token=" + token + " code=" + pairingCode + "\n",
	)); err != nil {
		t.Fatal(err)
	}

	eventsReq, _ := http.NewRequest(http.MethodGet, srv.URL+"/events", nil)
	eventsReq.Header.Set("authorization", "Bearer "+token)
	eventsRes, err := http.DefaultClient.Do(eventsReq)
	if err != nil {
		t.Fatal(err)
	}
	eventsBody, err := io.ReadAll(eventsRes.Body)
	eventsRes.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	if eventsRes.StatusCode != http.StatusOK {
		t.Fatalf("events status=%s body=%s", eventsRes.Status, eventsBody)
	}

	logsReq, _ := http.NewRequest(http.MethodGet, srv.URL+"/logs", nil)
	logsReq.Header.Set("authorization", "Bearer "+token)
	logsRes, err := http.DefaultClient.Do(logsReq)
	if err != nil {
		t.Fatal(err)
	}
	logsBody, err := io.ReadAll(logsRes.Body)
	logsRes.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	if logsRes.StatusCode != http.StatusOK {
		t.Fatalf("logs status=%s body=%s", logsRes.Status, logsBody)
	}

	for _, secret := range []string{token, qbitPass, pairingCode} {
		if strings.Contains(string(eventsBody), secret) {
			t.Fatalf("events response leaked secret %q: %s", secret, eventsBody)
		}
		if strings.Contains(string(logsBody), secret) {
			t.Fatalf("logs response leaked secret %q: %s", secret, logsBody)
		}
	}
	if !strings.Contains(string(eventsBody), "***") {
		t.Fatalf("events response shows no redaction marker at all, sanitizer may not be exercised: %s", eventsBody)
	}
	if !strings.Contains(string(logsBody), "***") {
		t.Fatalf("logs response shows no redaction marker at all, sanitizer may not be exercised: %s", logsBody)
	}
}
