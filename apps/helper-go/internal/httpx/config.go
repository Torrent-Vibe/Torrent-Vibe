package httpx

import (
	"encoding/json"
	"net/http"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/config"
)

func (rt *Runtime) currentConfig() config.File {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	return rt.Config
}

func (rt *Runtime) getConfig(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, rt.currentConfig().Public())
}

func (rt *Runtime) putConfig(w http.ResponseWriter, r *http.Request) {
	var patch struct {
		LibraryRoot    *string `json:"libraryRoot"`
		Category       *string `json:"category"`
		QbitURL        *string `json:"qbitUrl"`
		QbitUser       *string `json:"qbitUser"`
		QbitPass       *string `json:"qbitPass"`
		PollIntervalMs *int    `json:"pollIntervalMs"`
	}
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	next := rt.currentConfig()
	if patch.LibraryRoot != nil {
		next.LibraryRoot = *patch.LibraryRoot
	}
	if patch.Category != nil {
		if *patch.Category == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		next.Category = *patch.Category
	}
	qbitChanged := false
	if patch.QbitURL != nil {
		next.QbitURL = *patch.QbitURL
		qbitChanged = true
	}
	if patch.QbitUser != nil {
		next.QbitUser = *patch.QbitUser
		qbitChanged = true
	}
	if patch.QbitPass != nil && *patch.QbitPass != "" {
		next.QbitPass = *patch.QbitPass
		qbitChanged = true
	}
	if patch.PollIntervalMs != nil {
		next.PollIntervalMs = *patch.PollIntervalMs
	}
	if qbitChanged && rt.ProbeQbit != nil {
		if err := rt.ProbeQbit(next.QbitURL, next.QbitUser, next.QbitPass); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
	}
	if err := config.Save(rt.DataDir, next); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	rt.mu.Lock()
	rt.Config = next
	rt.AdvertisedQbit = next.QbitURL
	rt.mu.Unlock()
	if rt.ApplyConfig != nil {
		rt.ApplyConfig(next)
	}
	writeJSON(w, http.StatusOK, next.Public())
}
