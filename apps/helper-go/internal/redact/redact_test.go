package redact_test

import (
	"strings"
	"sync"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/events"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/redact"
)

func TestApplyRedactsRegisteredSecrets(t *testing.T) {
	r := redact.NewRegistry()
	r.Add("tok_abc123")
	r.Add("s3cr3t-pass")
	r.Add("PAIR-9F2K")

	got := r.Apply("token=tok_abc123 pass=s3cr3t-pass code=PAIR-9F2K done")
	for _, secret := range []string{"tok_abc123", "s3cr3t-pass", "PAIR-9F2K"} {
		if strings.Contains(got, secret) {
			t.Fatalf("Apply(%q) leaked secret %q", got, secret)
		}
	}
	if !strings.Contains(got, "***") {
		t.Fatalf("Apply(%q) did not redact anything", got)
	}
}

func TestApplyOverlappingSecretsFullyRedacted(t *testing.T) {
	r := redact.NewRegistry()
	r.Add("abc")
	r.Add("abcdef")

	got := r.Apply("prefix-abcdef-suffix")
	if strings.Contains(got, "abc") {
		t.Fatalf("Apply(%q) leaked partial secret", got)
	}
}

func TestApplyIgnoresEmptyAndWhitespaceSecrets(t *testing.T) {
	r := redact.NewRegistry()
	r.Add("")
	r.Add("   ")

	got := r.Apply("  nothing to hide  ")
	if got != "  nothing to hide  " {
		t.Fatalf("Apply(%q) modified string with only blank secrets registered", got)
	}
}

func TestApplyAfterRemoveNoLongerRedacts(t *testing.T) {
	r := redact.NewRegistry()
	r.Add("tok_abc123")
	r.Remove("tok_abc123")

	got := r.Apply("token=tok_abc123")
	if !strings.Contains(got, "tok_abc123") {
		t.Fatalf("Apply(%q) redacted a removed secret", got)
	}
}

func TestAllowedFieldsWhitelist(t *testing.T) {
	cases := []struct {
		kind string
		want []string
	}{
		{"tick.start", []string{"replicaCount"}},
		{"tick.done", []string{"replicaCount", "addedCount", "durationMs"}},
		{"rss.fetch", []string{"url", "httpStatus", "itemCount", "durationMs", "error"}},
		{"episode.new", []string{"title"}},
		{"episode.skip", []string{"reason", "rival"}},
		{"episode.manual", []string{"reason"}},
		{"torrent.fetch", []string{"url", "error"}},
		{"qb.add", []string{"hash", "savePath", "category", "tags", "error"}},
		{"qb.rename", []string{"from", "to", "error"}},
		{"qb.list", []string{"error"}},
		{"episode.done", []string{"hash"}},
		{"subscription.put", []string{"added", "removed"}},
		{"subscription.check", []string{"source"}},
		{"config.change", []string{"keys"}},
		{"pair", []string{"clientId"}},
		{"unpair", []string{"clientId"}},
	}
	for _, tc := range cases {
		got := redact.AllowedFields(tc.kind)
		if len(got) != len(tc.want) {
			t.Fatalf("AllowedFields(%q) = %v, want %v", tc.kind, got, tc.want)
		}
		for i, key := range tc.want {
			if got[i] != key {
				t.Fatalf("AllowedFields(%q) = %v, want %v", tc.kind, got, tc.want)
			}
		}
	}
}

func TestAllowedFieldsUnknownKindReturnsEmpty(t *testing.T) {
	got := redact.AllowedFields("totally.unknown")
	if len(got) != 0 {
		t.Fatalf("AllowedFields(unknown) = %v, want empty", got)
	}
}

func TestSanitizerDropsUnknownFieldKeys(t *testing.T) {
	r := redact.NewRegistry()
	sanitize := redact.Sanitizer(r)

	e := sanitize(events.Event{
		Kind: "qb.add",
		Fields: map[string]any{
			"hash":       "abc123",
			"qbitPass":   "s3cret",
			"unexpected": "value",
		},
	})

	if _, ok := e.Fields["qbitPass"]; ok {
		t.Fatalf("Fields retained non-whitelisted key qbitPass: %+v", e.Fields)
	}
	if _, ok := e.Fields["unexpected"]; ok {
		t.Fatalf("Fields retained non-whitelisted key unexpected: %+v", e.Fields)
	}
}

func TestSanitizerKeepsWhitelistedFieldKeys(t *testing.T) {
	r := redact.NewRegistry()
	sanitize := redact.Sanitizer(r)

	e := sanitize(events.Event{
		Kind: "qb.add",
		Fields: map[string]any{
			"hash":     "abc123",
			"savePath": "/data/lib",
		},
	})

	if e.Fields["hash"] != "abc123" || e.Fields["savePath"] != "/data/lib" {
		t.Fatalf("whitelisted fields dropped or altered: %+v", e.Fields)
	}
}

func TestSanitizerDropsAllFieldsForUnknownKind(t *testing.T) {
	r := redact.NewRegistry()
	sanitize := redact.Sanitizer(r)

	e := sanitize(events.Event{
		Kind: "totally.unknown",
		Fields: map[string]any{
			"anything": "value",
		},
	})

	if e.Fields != nil {
		t.Fatalf("Fields = %+v, want nil for unknown kind", e.Fields)
	}
}

func TestSanitizerRedactsMessageAndFieldStringsIncludingSlices(t *testing.T) {
	r := redact.NewRegistry()
	r.Add("s3cret-token")
	sanitize := redact.Sanitizer(r)

	e := sanitize(events.Event{
		Kind:    "qb.add",
		Message: "adding with token s3cret-token",
		Fields: map[string]any{
			"tags":  []string{"anime", "s3cret-token"},
			"error": "auth failed: s3cret-token",
		},
	})

	if strings.Contains(e.Message, "s3cret-token") {
		t.Fatalf("Message leaked secret: %q", e.Message)
	}
	errField, ok := e.Fields["error"].(string)
	if !ok || strings.Contains(errField, "s3cret-token") {
		t.Fatalf("error field leaked secret: %+v", e.Fields["error"])
	}
	tags, ok := e.Fields["tags"].([]string)
	if !ok {
		t.Fatalf("tags field type changed: %+v", e.Fields["tags"])
	}
	for _, tag := range tags {
		if strings.Contains(tag, "s3cret-token") {
			t.Fatalf("tags leaked secret: %+v", tags)
		}
	}
	if tags[0] != "anime" {
		t.Fatalf("non-secret tag altered: %+v", tags)
	}
}

func TestSanitizerNonStringFieldValuesPassThroughUntouched(t *testing.T) {
	r := redact.NewRegistry()
	sanitize := redact.Sanitizer(r)

	e := sanitize(events.Event{
		Kind: "tick.done",
		Fields: map[string]any{
			"replicaCount": 3,
			"durationMs":   1234,
		},
	})

	if e.Fields["replicaCount"] != 3 || e.Fields["durationMs"] != 1234 {
		t.Fatalf("non-string fields altered: %+v", e.Fields)
	}
}

func TestSwapNeverExposesGapToConcurrentApply(t *testing.T) {
	r := redact.NewRegistry()
	r.Add("old-secret")

	const text = "value old-secret and new-secret together"
	done := make(chan struct{})
	violation := make(chan string, 1)

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-done:
				return
			default:
			}
			got := r.Apply(text)
			if strings.Contains(got, "old-secret") && strings.Contains(got, "new-secret") {
				select {
				case violation <- got:
				default:
				}
			}
		}
	}()

	for i := 0; i < 5000; i++ {
		r.Swap("old-secret", "new-secret")
		r.Swap("new-secret", "old-secret")
	}
	close(done)
	wg.Wait()

	select {
	case got := <-violation:
		t.Fatalf("Apply observed neither old nor new secret redacted: %q", got)
	default:
	}
}

func TestRegistryConcurrentAddApplyIsRaceFree(t *testing.T) {
	r := redact.NewRegistry()
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			r.Add("secret")
		}()
		go func() {
			defer wg.Done()
			_ = r.Apply("some string with secret inside")
		}()
	}
	wg.Wait()
}
