package httpx

import (
	"net/http"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/events"
)

func (rt *Runtime) check(w http.ResponseWriter, _ *http.Request) {
	rt.kick("check")
	writeJSON(w, http.StatusAccepted, map[string]bool{"ok": true})
}

func (rt *Runtime) kick(source string) {
	if rt.Events != nil {
		rt.Events.Emit(events.Event{Level: "info", Kind: "subscription.check", Fields: map[string]any{"source": source}})
	}
	if rt.OnKick != nil {
		rt.OnKick(source)
	}
}
