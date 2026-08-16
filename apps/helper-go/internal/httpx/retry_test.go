package httpx_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/httpx"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

func TestRetryFailedWithTorrentURL(t *testing.T) {
	called := false
	srv := start(t, func(rt *httpx.Runtime) {
		season, ep := 1, 28
		_ = rt.Store.SaveEpisodes(map[string][]store.Episode{
			store.EpisodeKey("3141", "583"): {{
				EpisodeID: "e1", Title: "t", Season: &season, Episode: &ep,
				State: protocol.StateFailed, LastError: "x",
			}},
		})
		rt.OnBackfill = func(bangumiID, subgroupID string, episodes []mikan.RssEpisode) ([]store.Episode, error) {
			called = bangumiID == "3141" && subgroupID == "583" && len(episodes) == 1 && episodes[0].TorrentURL == "https://x"
			return []store.Episode{{EpisodeID: "e1", Title: "t", State: protocol.StateAdded}}, nil
		}
	})
	defer srv.Close()
	payload, _ := json.Marshal(map[string]string{
		"bangumiId": "3141", "subgroupId": "583", "episodeId": "e1", "torrentUrl": "https://x",
	})
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/retry", bytes.NewReader(payload))
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 || !called {
		t.Fatalf("status=%s called=%v", res.Status, called)
	}
	res.Body.Close()
}

func TestRetryDoneRejected(t *testing.T) {
	srv := start(t, func(rt *httpx.Runtime) {
		season, ep := 1, 1
		_ = rt.Store.SaveEpisodes(map[string][]store.Episode{
			store.EpisodeKey("3141", "583"): {{
				EpisodeID: "e1", Title: "t", Season: &season, Episode: &ep, State: protocol.StateDone,
			}},
		})
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/retry", bytes.NewBufferString(`{"bangumiId":"3141","subgroupId":"583","episodeId":"e1"}`))
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 400 {
		t.Fatal(res.Status)
	}
	res.Body.Close()
}

func TestRetryWithoutURLDeletesRow(t *testing.T) {
	var st *store.Store
	srv := start(t, func(rt *httpx.Runtime) {
		st = rt.Store
		season, ep := 1, 1
		_ = rt.Store.SaveEpisodes(map[string][]store.Episode{
			store.EpisodeKey("3141", "583"): {{
				EpisodeID: "e1", Title: "t", Season: &season, Episode: &ep, State: protocol.StateFailed,
			}},
		})
	})
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/retry", bytes.NewBufferString(`{"bangumiId":"3141","subgroupId":"583","episodeId":"e1"}`))
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
	res.Body.Close()
	maps, _ := st.LoadEpisodes()
	if len(maps[store.EpisodeKey("3141", "583")]) != 0 {
		t.Fatalf("%+v", maps)
	}
}
