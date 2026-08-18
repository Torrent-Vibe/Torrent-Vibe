package tmdb

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"unicode"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
)

type Client struct {
	key   string
	fetch func(rawURL string) ([]byte, error)
}

func New(key string, fetch func(rawURL string) ([]byte, error)) *Client {
	if fetch == nil {
		fetch = defaultFetch
	}
	return &Client{key: strings.TrimSpace(key), fetch: fetch}
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
		return nil, fmt.Errorf("tmdb %d", res.StatusCode)
	}
	return io.ReadAll(res.Body)
}

type Match struct {
	ID    int
	Title string
	Year  int
}

func (c *Client) SearchUniqueMovie(query string) (*Match, error) {
	return c.searchUnique("movie", query)
}

func (c *Client) SearchUniqueTV(query string) (*Match, error) {
	return c.searchUnique("tv", query)
}

func (c *Client) PickSeason(id int, ident mikan.Identity) *int {
	if c == nil || c.key == "" || id == 0 {
		return nil
	}
	seasons, err := c.seasons(id)
	if err != nil {
		return nil
	}
	return pickSeason(seasons, ident)
}

func (c *Client) ResolveSeason(ident mikan.Identity) *int {
	if c == nil || c.key == "" || !ident.SeasonAmbiguous || ident.Series == "" || ident.Kind != mikan.KindEpisode {
		return nil
	}
	match, err := c.searchUnique("tv", ident.Series)
	if err != nil || match == nil {
		return nil
	}
	return c.PickSeason(match.ID, ident)
}

func (c *Client) searchUnique(kind, query string) (*Match, error) {
	if c == nil || c.key == "" || strings.TrimSpace(query) == "" {
		return nil, nil
	}
	path := "/3/search/tv"
	if kind == "movie" {
		path = "/3/search/movie"
	}
	raw, err := c.fetch("https://api.themoviedb.org" + path + "?api_key=" + url.QueryEscape(c.key) + "&language=zh-CN&query=" + url.QueryEscape(query))
	if err != nil {
		return nil, err
	}
	var payload struct {
		Results []struct {
			ID             int    `json:"id"`
			Name           string `json:"name"`
			Title          string `json:"title"`
			OriginalName   string `json:"original_name"`
			OriginalTitle  string `json:"original_title"`
			FirstAirDate   string `json:"first_air_date"`
			ReleaseDate    string `json:"release_date"`
		} `json:"results"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	var hits []Match
	for _, item := range payload.Results {
		title := firstNonEmpty(item.Name, item.Title)
		original := firstNonEmpty(item.OriginalName, item.OriginalTitle)
		if namesFoldEqual(query, title) || namesFoldEqual(query, original) {
			year := yearFromDate(firstNonEmpty(item.ReleaseDate, item.FirstAirDate))
			hits = append(hits, Match{ID: item.ID, Title: firstNonEmpty(title, original, query), Year: year})
		}
	}
	if len(hits) != 1 {
		return nil, nil
	}
	return &hits[0], nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func yearFromDate(raw string) int {
	if len(raw) < 4 {
		return 0
	}
	year, err := strconv.Atoi(raw[:4])
	if err != nil || year < 1900 || year > 2100 {
		return 0
	}
	return year
}

func (c *Client) seasons(id int) ([]season, error) {
	raw, err := c.fetch("https://api.themoviedb.org/3/tv/" + strconv.Itoa(id) + "?api_key=" + url.QueryEscape(c.key) + "&language=zh-CN")
	if err != nil {
		return nil, err
	}
	var payload struct {
		Seasons []season `json:"seasons"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	return payload.Seasons, nil
}

type season struct {
	SeasonNumber int    `json:"season_number"`
	Name         string `json:"name"`
}

func pickSeason(seasons []season, ident mikan.Identity) *int {
	var usable []season
	for _, item := range seasons {
		if item.SeasonNumber > 0 {
			usable = append(usable, item)
		}
	}
	if len(usable) == 0 {
		return nil
	}
	switch ident.Hint {
	case mikan.HintPart:
		var hits []int
		needle := strconv.Itoa(ident.HintN)
		for _, item := range usable {
			if item.SeasonNumber == ident.HintN ||
				strings.Contains(item.Name, "Part "+needle) ||
				strings.Contains(item.Name, "part "+needle) ||
				strings.Contains(item.Name, "第"+needle) {
				hits = append(hits, item.SeasonNumber)
			}
		}
		if len(hits) != 1 {
			return nil
		}
		return &hits[0]
	case mikan.HintLast:
		best := usable[0].SeasonNumber
		for _, item := range usable[1:] {
			if item.SeasonNumber > best {
				best = item.SeasonNumber
			}
		}
		return &best
	case mikan.HintFirst:
		best := usable[0].SeasonNumber
		for _, item := range usable[1:] {
			if item.SeasonNumber < best {
				best = item.SeasonNumber
			}
		}
		return &best
	case mikan.HintRoman:
		for _, item := range usable {
			if item.SeasonNumber == ident.HintN {
				n := item.SeasonNumber
				return &n
			}
		}
		return nil
	default:
		return nil
	}
}

func namesFoldEqual(a, b string) bool {
	fa, fb := foldName(a), foldName(b)
	if fa == "" || fb == "" {
		return false
	}
	return fa == fb || strings.Contains(fa, fb) || strings.Contains(fb, fa)
}

func foldName(raw string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(raw) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}
