package httpx

import (
	"net/http"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/events"
)

func (rt *Runtime) getEvents(w http.ResponseWriter, r *http.Request) {
	query := events.Query{
		Since:     queryUint64(r, "since"),
		Level:     r.URL.Query().Get("level"),
		ReplicaID: r.URL.Query().Get("replicaId"),
		Kind:      r.URL.Query().Get("kind"),
		Limit:     queryInt(r, "limit"),
	}

	var (
		list   []events.Event
		cursor uint64
	)
	if rt.Events != nil {
		list, cursor = rt.Events.Query(query)
	}
	if list == nil {
		list = []events.Event{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"events": list, "cursor": cursor})
}
