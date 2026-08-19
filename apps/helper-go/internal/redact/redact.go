package redact

import (
	"sort"
	"strings"
	"sync"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/events"
)

type Registry struct {
	mu      sync.RWMutex
	secrets map[string]struct{}
}

func NewRegistry() *Registry {
	return &Registry{secrets: make(map[string]struct{})}
}

func (r *Registry) Add(secret string) {
	if strings.TrimSpace(secret) == "" {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.secrets[secret] = struct{}{}
}

func (r *Registry) Remove(secret string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.secrets, secret)
}

func (r *Registry) Apply(s string) string {
	r.mu.RLock()
	secrets := make([]string, 0, len(r.secrets))
	for secret := range r.secrets {
		secrets = append(secrets, secret)
	}
	r.mu.RUnlock()

	sort.Slice(secrets, func(i, j int) bool { return len(secrets[i]) > len(secrets[j]) })

	for _, secret := range secrets {
		s = strings.ReplaceAll(s, secret, "***")
	}
	return s
}

var fieldWhitelist = map[string][]string{
	"tick.start":         {"replicaCount"},
	"tick.done":          {"replicaCount", "addedCount", "durationMs"},
	"rss.fetch":          {"url", "httpStatus", "itemCount", "durationMs", "error"},
	"episode.new":        {"title"},
	"episode.skip":       {"reason", "rival"},
	"episode.manual":     {"reason"},
	"torrent.fetch":      {"url", "error"},
	"qb.add":             {"hash", "savePath", "category", "tags", "error"},
	"qb.rename":          {"from", "to", "error"},
	"episode.done":       {"hash"},
	"subscription.put":   {"added", "removed"},
	"subscription.check": {"source"},
	"config.change":      {"keys"},
	"pair":               {"clientId"},
	"unpair":             {"clientId"},
}

func AllowedFields(kind string) []string {
	fields := fieldWhitelist[kind]
	if len(fields) == 0 {
		return nil
	}
	out := make([]string, len(fields))
	copy(out, fields)
	return out
}

func Sanitizer(r *Registry) func(events.Event) events.Event {
	return func(e events.Event) events.Event {
		e.Message = r.Apply(e.Message)
		e.Fields = redactFields(r, e.Kind, e.Fields)
		return e
	}
}

func redactFields(r *Registry, kind string, fields map[string]any) map[string]any {
	allowed := AllowedFields(kind)
	if len(allowed) == 0 || len(fields) == 0 {
		return nil
	}

	out := make(map[string]any, len(allowed))
	for _, key := range allowed {
		value, ok := fields[key]
		if !ok {
			continue
		}
		out[key] = redactValue(r, value)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func redactValue(r *Registry, value any) any {
	switch v := value.(type) {
	case string:
		return r.Apply(v)
	case []string:
		out := make([]string, len(v))
		for i, s := range v {
			out[i] = r.Apply(s)
		}
		return out
	default:
		return value
	}
}
