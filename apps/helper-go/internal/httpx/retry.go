package httpx

import (
	"encoding/json"
	"net/http"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

func (rt *Runtime) retry(w http.ResponseWriter, r *http.Request) {
	var body struct {
		BangumiID  string `json:"bangumiId"`
		SubgroupID string `json:"subgroupId"`
		EpisodeID  string `json:"episodeId"`
		Title      string `json:"title"`
		TorrentURL string `json:"torrentUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.BangumiID == "" || body.SubgroupID == "" || body.EpisodeID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	key := store.EpisodeKey(body.BangumiID, body.SubgroupID)
	maps, err := rt.Store.LoadEpisodes()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	list := maps[key]
	index := -1
	var current store.Episode
	for i, item := range list {
		if item.EpisodeID == body.EpisodeID {
			index = i
			current = item
			break
		}
	}
	if index == -1 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if current.State != protocol.StateFailed && current.State != protocol.StateNeedsManual {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	next := append([]store.Episode(nil), list[:index]...)
	next = append(next, list[index+1:]...)
	maps[key] = next
	if err := rt.Store.SaveEpisodes(maps); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	if body.TorrentURL != "" && rt.OnBackfill != nil {
		title := body.Title
		if title == "" {
			title = current.Title
		}
		episodes, err := rt.OnBackfill(body.BangumiID, body.SubgroupID, []mikan.RssEpisode{{
			EpisodeID:  body.EpisodeID,
			Title:      title,
			TorrentURL: body.TorrentURL,
		}})
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"episodes": episodes})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"episodes": next})
}
