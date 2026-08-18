package analyze

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"

	"github.com/cloudwego/eino/flow/agent/react"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/tmdb"
)

type webSearchInput struct {
	Query      string `json:"query"`
	Language   string `json:"language,omitempty"`
	MaxResults int    `json:"maxResults,omitempty"`
}

type tmdbSearchInput struct {
	Query     string `json:"query"`
	Year      int    `json:"year,omitempty"`
	MediaType string `json:"mediaType,omitempty"`
	Language  string `json:"language,omitempty"`
}

type tmdbDetailsInput struct {
	ID        int    `json:"id"`
	MediaType string `json:"mediaType"`
	Language  string `json:"language,omitempty"`
}

type submitInput struct {
	MediaType string `json:"mediaType"`
	Title     struct {
		CanonicalTitle string `json:"canonicalTitle"`
		ReleaseYear    *int   `json:"releaseYear"`
		SeasonNumber   *int   `json:"seasonNumber"`
		EpisodeNumbers []int  `json:"episodeNumbers"`
	} `json:"title"`
	Series *struct {
		SeasonNumber   *int  `json:"seasonNumber"`
		EpisodeNumbers []int `json:"episodeNumbers"`
	} `json:"series"`
	TMDB *struct {
		ID          int    `json:"id"`
		MediaType   string `json:"mediaType"`
		Title       string `json:"title"`
		ReleaseDate string `json:"releaseDate"`
	} `json:"tmdb"`
	Confidence struct {
		Overall   float64  `json:"overall"`
		TMDBMatch *float64 `json:"tmdbMatch"`
	} `json:"confidence"`
}

func (c *Client) webSearchTool(ctx context.Context, input webSearchInput) (string, error) {
	hits, err := c.searchWeb(ctx, input.Query, input.MaxResults)
	if err != nil {
		return "", err
	}
	return toolJSON(map[string]any{"ok": true, "results": hits}), nil
}

func (c *Client) tmdbSearchTool(_ context.Context, input tmdbSearchInput) (string, error) {
	if c.TMDB == nil {
		return `{"ok":false,"error":"tmdb.notConfigured"}`, nil
	}
	hits, err := c.TMDB.Search(tmdb.SearchQuery{
		Query:     input.Query,
		MediaType: input.MediaType,
		Year:      input.Year,
		Language:  input.Language,
	})
	if err != nil {
		return "", err
	}
	return toolJSON(map[string]any{"ok": true, "results": hits}), nil
}

func (c *Client) tmdbDetailsTool(_ context.Context, input tmdbDetailsInput) (string, error) {
	if c.TMDB == nil {
		return `{"ok":false,"error":"tmdb.notConfigured"}`, nil
	}
	detail, err := c.TMDB.Details(input.ID, input.MediaType, input.Language)
	if err != nil {
		return "", err
	}
	if detail == nil {
		return `{"ok":false,"error":"tmdb.emptyResponse"}`, nil
	}
	return toolJSON(map[string]any{"ok": true, "result": detail}), nil
}

func (c *Client) submitMetadataTool(ctx context.Context, input submitInput) (string, error) {
	_ = react.SetReturnDirectly(ctx)
	raw, err := json.Marshal(input)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func (in submitInput) identity() *Identity {
	ident := &Identity{
		Title:      firstNonEmpty(in.Title.CanonicalTitle),
		MediaType:  strings.ToLower(strings.TrimSpace(in.MediaType)),
		Confidence: in.Confidence.Overall,
	}
	if in.Title.ReleaseYear != nil {
		ident.Year = *in.Title.ReleaseYear
	}
	if in.Title.SeasonNumber != nil {
		ident.Season = in.Title.SeasonNumber
	}
	if n := firstEpisode(in.Title.EpisodeNumbers); n != nil {
		ident.Episode = n
	}
	if in.Series != nil {
		if ident.Season == nil && in.Series.SeasonNumber != nil {
			ident.Season = in.Series.SeasonNumber
		}
		if ident.Episode == nil {
			ident.Episode = firstEpisode(in.Series.EpisodeNumbers)
		}
	}
	if in.TMDB != nil {
		ident.TMDBID = in.TMDB.ID
		ident.Title = firstNonEmpty(ident.Title, in.TMDB.Title)
		if ident.MediaType == "" {
			ident.MediaType = strings.ToLower(strings.TrimSpace(in.TMDB.MediaType))
		}
		if ident.Year == 0 && len(in.TMDB.ReleaseDate) >= 4 {
			if year, err := strconv.Atoi(in.TMDB.ReleaseDate[:4]); err == nil {
				ident.Year = year
			}
		}
	}
	if in.Confidence.TMDBMatch != nil && *in.Confidence.TMDBMatch > ident.Confidence {
		ident.Confidence = *in.Confidence.TMDBMatch
	}
	return ident
}
