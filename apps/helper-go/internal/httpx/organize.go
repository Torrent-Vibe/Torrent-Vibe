package httpx

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/organize"
)

func (rt *Runtime) getOrganize(w http.ResponseWriter, r *http.Request) {
	hash := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("hash")))
	if hash == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if rt.OnOrganizePlan == nil {
		writeJSON(w, http.StatusOK, organize.Result{Hash: hash, Status: organize.StatusNeedsManual, Reason: organize.ReasonTorrentMissing})
		return
	}
	writeJSON(w, http.StatusOK, rt.OnOrganizePlan(hash))
}

func (rt *Runtime) postOrganize(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Hash string `json:"hash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	hash := strings.ToLower(strings.TrimSpace(body.Hash))
	if hash == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if rt.OnOrganizeApply == nil {
		writeJSON(w, http.StatusOK, organize.Result{Hash: hash, Status: organize.StatusNeedsManual, Reason: organize.ReasonTorrentMissing})
		return
	}
	writeJSON(w, http.StatusOK, rt.OnOrganizeApply(hash))
}
