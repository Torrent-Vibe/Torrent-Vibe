package httpx

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

func (rt *Runtime) getProfile(w http.ResponseWriter, _ *http.Request) {
	if rt.ProfileStore == nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	snapshot, err := rt.ProfileStore.Load()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func (rt *Runtime) patchProfile(w http.ResponseWriter, r *http.Request) {
	if rt.ProfileStore == nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	var body struct {
		Revision  *uint64                 `json:"revision"`
		Mutations []store.ProfileMutation `json:"mutations"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Revision == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	clientID, _ := r.Context().Value(clientContextKey{}).(string)
	snapshot, err := rt.ProfileStore.Apply(*body.Revision, clientID, body.Mutations)
	if errors.Is(err, store.ErrProfileRevisionConflict) {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error": "revision conflict", "revision": snapshot.Revision, "records": snapshot.Records,
		})
		return
	}
	if errors.Is(err, store.ErrInvalidProfileMutation) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}
