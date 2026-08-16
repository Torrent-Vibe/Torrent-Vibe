package httpx

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/config"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

type Runtime struct {
	Version        string
	Port           int
	AdvertisedQbit string
	PairingCode    string
	Token          string
	Bound          bool
	Store          *store.Store
	DataDir        string
	Config         config.File
	OnBackfill     func(bangumiID, subgroupID string, episodes []mikan.RssEpisode) ([]store.Episode, error)
	OnUnpair       func() error
	ProbeQbit      func(url, user, pass string) error
	ApplyConfig    func(config.File)
	mu             sync.Mutex
}

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
	mux.HandleFunc("POST /retry", rt.authed(rt.retry))
	return mux
}

func (rt *Runtime) authed(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rt.mu.Lock()
		token := rt.Token
		rt.mu.Unlock()
		if !authorize(r, token) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		next(w, r)
	}
}

func (rt *Runtime) discover(w http.ResponseWriter, _ *http.Request) {
	rt.mu.Lock()
	bound := rt.Bound
	rt.mu.Unlock()
	state := "unbound"
	if bound {
		state = "bound"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"version":           rt.Version,
		"bindState":         state,
		"advertisedQbitUrl": rt.AdvertisedQbit,
		"pairingCode":       rt.PairingCode,
		"port":              rt.Port,
	})
}

func (rt *Runtime) pair(w http.ResponseWriter, r *http.Request) {
	body, ok := readJSON(w, r)
	if !ok {
		return
	}
	code, _ := body["code"].(string)
	if !safeEqual(code, rt.PairingCode) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	rt.mu.Lock()
	token := rt.Token
	rt.Bound = true
	rt.mu.Unlock()
	if err := store.SavePairing(rt.DataDir, store.Pairing{Bound: true, Token: token}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"token": token})
}

func (rt *Runtime) getSubscriptions(w http.ResponseWriter, _ *http.Request) {
	replicas, err := rt.Store.LoadReplicas()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"replicas": replicas})
}

func (rt *Runtime) putSubscriptions(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Replicas []protocol.Replica `json:"replicas"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Replicas == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	current, err := rt.Store.LoadReplicas()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	next := applyDesired(current, body.Replicas)
	if err := rt.Store.SaveReplicas(next); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"replicas": next})
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
	type replicaStatus struct {
		protocol.Replica
		Episodes []store.Episode `json:"episodes"`
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
		out = append(out, replicaStatus{Replica: replica, Episodes: list})
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
		BangumiID  string            `json:"bangumiId"`
		SubgroupID string            `json:"subgroupId"`
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

func (rt *Runtime) unpair(w http.ResponseWriter, _ *http.Request) {
	if rt.OnUnpair != nil {
		if err := rt.OnUnpair(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
			return
		}
	} else {
		next, err := store.RotateToken(rt.DataDir)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
			return
		}
		if err := rt.Store.ClearAll(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
			return
		}
		rt.mu.Lock()
		rt.Token = next.Token
		rt.Bound = false
		rt.mu.Unlock()
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
