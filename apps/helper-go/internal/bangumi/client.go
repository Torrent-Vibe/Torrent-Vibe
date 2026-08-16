package bangumi

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
)

type Episode struct {
	Sort    float64
	AirDate string
	Name    string
}

type Client struct {
	fetch func(url string) ([]byte, error)
	now   func() time.Time
	mu    sync.Mutex
	cache map[string]cacheEntry
}

type cacheEntry struct {
	episodes []Episode
	until    time.Time
}

func New(fetch func(url string) ([]byte, error), now func() time.Time) *Client {
	if fetch == nil {
		fetch = defaultFetch
	}
	if now == nil {
		now = time.Now
	}
	return &Client{fetch: fetch, now: now, cache: map[string]cacheEntry{}}
}

func defaultFetch(rawURL string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("user-agent", "torrent-vibe-helper/0.0.1")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("bangumi %d", res.StatusCode)
	}
	return io.ReadAll(res.Body)
}

func (c *Client) Episodes(subjectID string) ([]Episode, error) {
	c.mu.Lock()
	if entry, ok := c.cache[subjectID]; ok && c.now().Before(entry.until) {
		c.mu.Unlock()
		return entry.episodes, nil
	}
	c.mu.Unlock()
	raw, err := c.fetch("https://api.bgm.tv/v0/episodes?subject_id=" + subjectID + "&type=0&limit=100")
	if err != nil {
		return nil, err
	}
	var payload struct {
		Data []struct {
			Sort    float64 `json:"sort"`
			Airdate string  `json:"airdate"`
			Name    string  `json:"name"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	episodes := make([]Episode, 0, len(payload.Data))
	for _, item := range payload.Data {
		episodes = append(episodes, Episode{Sort: item.Sort, AirDate: item.Airdate, Name: item.Name})
	}
	c.mu.Lock()
	c.cache[subjectID] = cacheEntry{episodes: episodes, until: c.now().Add(time.Hour)}
	c.mu.Unlock()
	return episodes, nil
}

func Match(parsed mikan.ParsedTitle, item mikan.RssEpisode, episodes []Episode) mikan.ParsedTitle {
	if parsed.Episode != nil {
		return parsed
	}
	published, ok := parsePublished(item.PublishedAt)
	if !ok {
		return parsed
	}
	var hits []Episode
	for _, episode := range episodes {
		air, err := time.Parse("2006-01-02", episode.AirDate)
		if err != nil {
			continue
		}
		delta := published.UTC().Sub(air.UTC())
		if delta < 0 {
			delta = -delta
		}
		if delta <= 24*time.Hour {
			hits = append(hits, episode)
		}
	}
	if len(hits) != 1 {
		return parsed
	}
	n := int(math.Round(hits[0].Sort))
	if n <= 0 {
		return parsed
	}
	parsed.Episode = &n
	if parsed.Season == nil {
		season := 1
		parsed.Season = &season
	}
	return parsed
}

func parsePublished(raw string) (time.Time, bool) {
	if raw == "" {
		return time.Time{}, false
	}
	layouts := []string{time.RFC3339, "2006-01-02T15:04:05Z07:00", "2006-01-02T15:04:05Z", "2006-01-02T15:04:05"}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, raw); err == nil {
			return parsed, true
		}
	}
	if n, err := strconv.ParseInt(raw, 10, 64); err == nil {
		return time.Unix(n, 0), true
	}
	return time.Time{}, false
}

func Resolve(client *Client, replicaSubjectID string, item mikan.RssEpisode, parsed mikan.ParsedTitle) mikan.ParsedTitle {
	if parsed.Episode != nil || replicaSubjectID == "" || client == nil {
		return parsed
	}
	episodes, err := client.Episodes(replicaSubjectID)
	if err != nil {
		return parsed
	}
	return Match(parsed, item, episodes)
}
