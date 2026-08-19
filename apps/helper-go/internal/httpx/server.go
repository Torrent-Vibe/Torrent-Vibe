package httpx

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/config"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/events"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/redact"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

type Runtime struct {
	Version          string
	Port             int
	AdvertisedQbit   string
	Pairings         *store.PairingStore
	ProfileStore     *store.ProfileStore
	Store            *store.Store
	DataDir          string
	Config           config.File
	Events           events.Recorder
	Redact           *redact.Registry
	OnBackfill       func(bangumiID, subgroupID string, episodes []mikan.RssEpisode) ([]store.Episode, error)
	OnDeleteTorrents func(hashes []string, deleteFiles bool) error
	ProbeQbit        func(url, user, pass string) error
	ApplyConfig      func(config.File)
	mu               sync.Mutex
	subscriptionsMu  sync.Mutex
	pairAttempts     *attemptLimiter
	pairAttemptsOnce sync.Once
}

type clientContextKey struct{}

func New(rt *Runtime) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /discover", rt.discover)
	mux.HandleFunc("POST /pair", rt.pair)
	mux.HandleFunc("GET /subscriptions", rt.authed(rt.getSubscriptions))
	mux.HandleFunc("PUT /subscriptions", rt.authed(rt.putSubscriptions))
	mux.HandleFunc("GET /status", rt.authed(rt.status))
	mux.HandleFunc("POST /backfill", rt.authed(rt.backfill))
	mux.HandleFunc("POST /unpair", rt.authed(rt.unpair))
	mux.HandleFunc("GET /config", rt.authed(rt.getConfig))
	mux.HandleFunc("PUT /config", rt.authed(rt.putConfig))
	mux.HandleFunc("GET /profile", rt.authed(rt.getProfile))
	mux.HandleFunc("PATCH /profile", rt.authed(rt.patchProfile))
	mux.HandleFunc("POST /retry", rt.authed(rt.retry))
	return mux
}

func (rt *Runtime) authed(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, ok := bearerToken(r)
		if !ok || rt.Pairings == nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		client, ok := rt.Pairings.Authenticate(token)
		if !ok {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		ctx := context.WithValue(r.Context(), clientContextKey{}, client.ID)
		next(w, r.WithContext(ctx))
	}
}

func (rt *Runtime) discover(w http.ResponseWriter, _ *http.Request) {
	clientCount := 0
	if rt.Pairings != nil {
		clientCount = rt.Pairings.ClientCount()
	}
	state := "unbound"
	if clientCount > 0 {
		state = "bound"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"version":             rt.Version,
		"capabilities":        []string{"profile-sync-v1"},
		"bindState":           state,
		"advertisedQbitUrl":   rt.AdvertisedQbit,
		"clientCount":         clientCount,
		"requiresPairingCode": true,
		"port":                rt.Port,
	})
}

func (rt *Runtime) limiter() *attemptLimiter {
	rt.pairAttemptsOnce.Do(func() {
		if rt.pairAttempts == nil {
			rt.pairAttempts = newAttemptLimiter(pairAttemptLimit, pairGlobalAttemptLimit, pairAttemptWindow)
		}
	})
	return rt.pairAttempts
}

func (rt *Runtime) pair(w http.ResponseWriter, r *http.Request) {
	limiter := rt.limiter()
	key := clientKey(r)
	if wait, blocked := limiter.retryAfter(key); blocked {
		w.Header().Set("retry-after", strconv.Itoa(int(math.Ceil(wait.Seconds()))))
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "tooManyAttempts"})
		return
	}
	body, ok := readJSON(w, r)
	if !ok {
		return
	}
	expected, err := store.LoadOrCreatePairingCode(rt.DataDir)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	code, _ := body["code"].(string)
	if !safeEqual(strings.ToUpper(strings.TrimSpace(code)), expected) {
		limiter.fail(key)
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	limiter.succeed(key)
	clientID, _ := body["clientId"].(string)
	clientName, _ := body["clientName"].(string)
	if rt.Pairings == nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	token, err := rt.Pairings.Pair(clientID, clientName)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid client"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"clientId": strings.TrimSpace(clientID), "token": token})
}

func (rt *Runtime) getSubscriptions(w http.ResponseWriter, _ *http.Request) {
	snapshot, err := rt.Store.LoadReplicaSnapshot()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"revision": snapshot.Revision, "replicas": snapshot.Replicas})
}

func (rt *Runtime) putSubscriptions(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Revision       *uint64            `json:"revision"`
		Replicas       []protocol.Replica `json:"replicas"`
		RemoveTorrents bool               `json:"removeTorrents"`
		DeleteFiles    bool               `json:"deleteFiles"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Replicas == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if body.Revision == nil {
		writeJSON(w, http.StatusPreconditionRequired, map[string]string{"error": "revision required"})
		return
	}

	rt.subscriptionsMu.Lock()
	defer rt.subscriptionsMu.Unlock()
	snapshot, err := rt.Store.LoadReplicaSnapshot()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	if snapshot.Revision != *body.Revision {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error": "revision conflict", "revision": snapshot.Revision, "replicas": snapshot.Replicas,
		})
		return
	}
	if body.RemoveTorrents {
		if err := rt.dropRemovedTorrents(snapshot.Replicas, body.Replicas, body.DeleteFiles); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
			return
		}
	}
	next := applyDesired(snapshot.Replicas, body.Replicas)
	saved, err := rt.Store.SaveReplicasIfRevision(next, *body.Revision)
	if errors.Is(err, store.ErrRevisionConflict) {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error": "revision conflict", "revision": saved.Revision, "replicas": saved.Replicas,
		})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"revision": saved.Revision, "replicas": saved.Replicas})
}

func (rt *Runtime) dropRemovedTorrents(current, desired []protocol.Replica, deleteFiles bool) error {
	episodes, err := rt.Store.LoadEpisodes()
	if err != nil {
		return err
	}
	currentByID := make(map[string]protocol.Replica, len(current))
	for _, replica := range current {
		currentByID[replica.ID] = replica
	}
	changed := false
	for _, op := range protocol.DesiredStateDiff(desired, current) {
		if op.Type != protocol.OpRemove {
			continue
		}
		replica, ok := currentByID[op.ID]
		if !ok {
			continue
		}
		key := store.EpisodeKey(replica.BangumiID, replica.SubgroupID)
		list := episodes[key]
		hashes := make([]string, 0, len(list))
		for _, episode := range list {
			if episode.Infohash != "" {
				hashes = append(hashes, episode.Infohash)
			}
		}
		if len(hashes) == 0 {
			delete(episodes, key)
			changed = true
			continue
		}
		if rt.OnDeleteTorrents == nil {
			continue
		}
		if err := rt.OnDeleteTorrents(hashes, deleteFiles); err != nil {
			continue
		}
		delete(episodes, key)
		changed = true
	}
	if !changed {
		return nil
	}
	return rt.Store.SaveEpisodes(episodes)
}

func applyDesired(current, desired []protocol.Replica) []protocol.Replica {
	next := append([]protocol.Replica(nil), current...)
	for _, op := range protocol.DesiredStateDiff(desired, current) {
		if op.Type == protocol.OpRemove {
			filtered := next[:0]
			for _, replica := range next {
				if replica.ID != op.ID {
					filtered = append(filtered, replica)
				}
			}
			next = filtered
			continue
		}
		next = append(next, op.Replica)
	}
	return next
}

func (rt *Runtime) status(w http.ResponseWriter, _ *http.Request) {
	replicas, err := rt.Store.LoadReplicas()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	episodes, err := rt.Store.LoadEpisodes()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	checks, err := rt.Store.LoadReplicaChecks()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	type replicaStatus struct {
		protocol.Replica
		Episodes            []store.Episode `json:"episodes"`
		CheckedAt           *string         `json:"checkedAt,omitempty"`
		CheckError          string          `json:"checkError,omitempty"`
		ConsecutiveFailures *int            `json:"consecutiveFailures,omitempty"`
	}
	out := make([]replicaStatus, 0, len(replicas))
	covered := map[string]struct{}{}
	for _, replica := range replicas {
		key := store.EpisodeKey(replica.BangumiID, replica.SubgroupID)
		covered[key] = struct{}{}
		list := episodes[key]
		if list == nil {
			list = []store.Episode{}
		}
		entry := replicaStatus{Replica: replica, Episodes: list}
		if check, ok := checks[key]; ok {
			checkedAt := check.CheckedAt.Format(time.RFC3339)
			failures := check.ConsecutiveFailures
			entry.CheckedAt = &checkedAt
			entry.CheckError = check.CheckError
			entry.ConsecutiveFailures = &failures
		}
		out = append(out, entry)
	}
	type job struct {
		BangumiID  string          `json:"bangumiId"`
		SubgroupID string          `json:"subgroupId"`
		Episodes   []store.Episode `json:"episodes"`
	}
	jobs := []job{}
	for key, list := range episodes {
		if _, ok := covered[key]; ok {
			continue
		}
		bangumiID, subgroupID := key, ""
		if i := strings.Index(key, ":"); i >= 0 {
			bangumiID, subgroupID = key[:i], key[i+1:]
		}
		jobs = append(jobs, job{BangumiID: bangumiID, SubgroupID: subgroupID, Episodes: list})
	}
	writeJSON(w, http.StatusOK, map[string]any{"replicas": out, "jobs": jobs})
}

func (rt *Runtime) backfill(w http.ResponseWriter, r *http.Request) {
	var body struct {
		BangumiID  string             `json:"bangumiId"`
		SubgroupID string             `json:"subgroupId"`
		Episodes   []mikan.RssEpisode `json:"episodes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.BangumiID == "" || body.SubgroupID == "" || body.Episodes == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if rt.OnBackfill == nil {
		writeJSON(w, http.StatusOK, map[string]any{"episodes": []store.Episode{}})
		return
	}
	episodes, err := rt.OnBackfill(body.BangumiID, body.SubgroupID, body.Episodes)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"episodes": episodes})
}

func (rt *Runtime) unpair(w http.ResponseWriter, r *http.Request) {
	clientID, _ := r.Context().Value(clientContextKey{}).(string)
	if clientID == "" || rt.Pairings == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if err := rt.Pairings.Revoke(clientID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
