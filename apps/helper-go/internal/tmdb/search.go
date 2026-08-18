package tmdb

import (
	"encoding/json"
	"net/url"
	"strconv"
	"strings"
)

type Hit struct {
	ID            int    `json:"id"`
	MediaType     string `json:"mediaType"`
	Title         string `json:"title"`
	OriginalTitle string `json:"originalTitle,omitempty"`
	ReleaseDate   string `json:"releaseDate,omitempty"`
	Year          int    `json:"year,omitempty"`
	Overview      string `json:"overview,omitempty"`
	SeasonCount   int    `json:"seasonCount,omitempty"`
	EpisodeCount  int    `json:"episodeCount,omitempty"`
}

type SearchQuery struct {
	Query     string
	MediaType string
	Year      int
	Language  string
}

func (c *Client) Search(query SearchQuery) ([]Hit, error) {
	if c == nil || c.key == "" || strings.TrimSpace(query.Query) == "" {
		return nil, nil
	}
	kind := normalizeMediaType(query.MediaType)
	path := "/3/search/multi"
	if kind == "movie" || kind == "tv" {
		path = "/3/search/" + kind
	}
	params := url.Values{}
	params.Set("api_key", c.key)
	params.Set("language", languageOrDefault(query.Language))
	params.Set("query", strings.TrimSpace(query.Query))
	params.Set("include_adult", "false")
	params.Set("page", "1")
	if query.Year > 0 {
		if kind == "tv" {
			params.Set("first_air_date_year", strconv.Itoa(query.Year))
		} else {
			params.Set("year", strconv.Itoa(query.Year))
		}
	}
	raw, err := c.fetch("https://api.themoviedb.org" + path + "?" + params.Encode())
	if err != nil {
		return nil, err
	}
	var payload struct {
		Results []searchEntry `json:"results"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	hits := make([]Hit, 0, len(payload.Results))
	for _, entry := range payload.Results {
		if hit := mapSearchEntry(entry, kind); hit != nil {
			hits = append(hits, *hit)
		}
	}
	return hits, nil
}

func (c *Client) Details(id int, mediaType, language string) (*Hit, error) {
	if c == nil || c.key == "" || id <= 0 {
		return nil, nil
	}
	kind := normalizeMediaType(mediaType)
	if kind != "movie" && kind != "tv" {
		return nil, nil
	}
	params := url.Values{}
	params.Set("api_key", c.key)
	params.Set("language", languageOrDefault(language))
	raw, err := c.fetch("https://api.themoviedb.org/3/" + kind + "/" + strconv.Itoa(id) + "?" + params.Encode())
	if err != nil {
		return nil, err
	}
	var entry searchEntry
	if err := json.Unmarshal(raw, &entry); err != nil {
		return nil, err
	}
	entry.MediaType = kind
	hit := mapSearchEntry(entry, kind)
	if hit == nil {
		return nil, nil
	}
	hit.Overview = strings.TrimSpace(entry.Overview)
	if entry.NumberOfSeasons > 0 {
		hit.SeasonCount = entry.NumberOfSeasons
	}
	if entry.NumberOfEpisodes > 0 {
		hit.EpisodeCount = entry.NumberOfEpisodes
	}
	return hit, nil
}

type searchEntry struct {
	ID               int    `json:"id"`
	MediaType        string `json:"media_type"`
	Name             string `json:"name"`
	Title            string `json:"title"`
	OriginalName     string `json:"original_name"`
	OriginalTitle    string `json:"original_title"`
	FirstAirDate     string `json:"first_air_date"`
	ReleaseDate      string `json:"release_date"`
	Overview         string `json:"overview"`
	NumberOfSeasons  int    `json:"number_of_seasons"`
	NumberOfEpisodes int    `json:"number_of_episodes"`
}

func mapSearchEntry(entry searchEntry, fallback string) *Hit {
	kind := normalizeMediaType(entry.MediaType)
	if kind == "" {
		kind = fallback
	}
	if kind == "" {
		if strings.TrimSpace(entry.ReleaseDate) != "" || strings.TrimSpace(entry.OriginalTitle) != "" {
			kind = "movie"
		} else if strings.TrimSpace(entry.FirstAirDate) != "" || strings.TrimSpace(entry.OriginalName) != "" {
			kind = "tv"
		}
	}
	if kind != "movie" && kind != "tv" {
		return nil
	}
	title := firstNonEmpty(entry.Title, entry.Name)
	original := firstNonEmpty(entry.OriginalTitle, entry.OriginalName)
	if kind == "tv" {
		title = firstNonEmpty(entry.Name, entry.Title)
		original = firstNonEmpty(entry.OriginalName, entry.OriginalTitle)
	}
	if title == "" {
		return nil
	}
	date := firstNonEmpty(entry.ReleaseDate, entry.FirstAirDate)
	if kind == "tv" {
		date = firstNonEmpty(entry.FirstAirDate, entry.ReleaseDate)
	}
	return &Hit{
		ID:            entry.ID,
		MediaType:     kind,
		Title:         title,
		OriginalTitle: original,
		ReleaseDate:   date,
		Year:          yearFromDate(date),
	}
}

func normalizeMediaType(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "movie":
		return "movie"
	case "tv", "anime":
		return "tv"
	default:
		return ""
	}
}

func languageOrDefault(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return "zh-CN"
	}
	return strings.TrimSpace(raw)
}
