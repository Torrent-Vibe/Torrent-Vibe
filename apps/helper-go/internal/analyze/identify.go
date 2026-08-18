package analyze

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/tmdb"
)

const (
	MinConfidence = 0.8
	maxTurns      = 8
	maxFiles      = 40
)

type Identity struct {
	Title      string
	Year       int
	Season     *int
	Episode    *int
	MediaType  string
	TMDBID     int
	Confidence float64
}

func (id Identity) Ready() bool {
	if id.TMDBID <= 0 || strings.TrimSpace(id.Title) == "" || id.Confidence < MinConfidence {
		return false
	}
	switch id.MediaType {
	case "movie", "tv", "anime":
		return true
	default:
		return false
	}
}

type Request struct {
	TorrentName string
	Files       []string
	ParsedTitle string
	ParsedYear  int
	ParsedKind  string
	Season      *int
	Episode     *int
}

type Client struct {
	Provider Provider
	TMDB     *tmdb.Client
	Chat     func(context.Context, ChatRequest) (ChatResponse, error)
}

func New(provider Provider, tmdbClient *tmdb.Client, post PostJSON) *Client {
	return &Client{
		Provider: provider,
		TMDB:     tmdbClient,
		Chat:     HTTPChat(post, provider),
	}
}

func (c *Client) Identify(ctx context.Context, request Request) (*Identity, error) {
	if c == nil || strings.TrimSpace(c.Provider.APIKey) == "" || c.Chat == nil {
		return nil, nil
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, 45*time.Second)
		defer cancel()
	}
	messages := []ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt(request)},
	}
	var submitted *Identity
	for turn := 0; turn < maxTurns; turn++ {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		choice := any("auto")
		if turn == maxTurns-1 {
			choice = map[string]any{
				"type":     "function",
				"function": map[string]string{"name": "submitMetadata"},
			}
		}
		response, err := c.Chat(ctx, ChatRequest{
			Model:      c.Provider.Model,
			Messages:   messages,
			Tools:      chatTools(),
			ToolChoice: choice,
		})
		if err != nil {
			return nil, err
		}
		message := response.Choices[0].Message
		if len(message.ToolCalls) == 0 {
			if ident := parseIdentityJSON(message.Content); ident != nil {
				submitted = ident
				break
			}
			return nil, nil
		}
		messages = append(messages, ChatMessage{
			Role:      "assistant",
			Content:   message.Content,
			ToolCalls: message.ToolCalls,
		})
		for _, call := range message.ToolCalls {
			name := strings.TrimSpace(call.Function.Name)
			if name == "submitMetadata" {
				ident := parseIdentityJSON(call.Function.Arguments)
				if ident == nil {
					messages = append(messages, toolMessage(call.ID, `{"ok":false,"error":"invalid submitMetadata"}`))
					continue
				}
				submitted = ident
				messages = append(messages, toolMessage(call.ID, `{"ok":true}`))
				continue
			}
			payload, err := c.runTool(name, call.Function.Arguments)
			if err != nil {
				payload = fmt.Sprintf(`{"ok":false,"error":%q}`, err.Error())
			}
			messages = append(messages, toolMessage(call.ID, payload))
		}
		if submitted != nil {
			break
		}
	}
	return c.confirm(submitted)
}

func (c *Client) confirm(ident *Identity) (*Identity, error) {
	if ident == nil {
		return nil, nil
	}
	if ident.MediaType == "music" || ident.MediaType == "other" {
		return ident, nil
	}
	if !ident.Ready() || c.TMDB == nil {
		return nil, nil
	}
	detail, err := c.TMDB.Details(ident.TMDBID, ident.MediaType, "zh-CN")
	if err != nil || detail == nil || detail.ID == 0 {
		return nil, err
	}
	ident.Title = firstNonEmpty(detail.Title, ident.Title)
	if detail.Year > 0 {
		ident.Year = detail.Year
	}
	if ident.MediaType != "anime" {
		ident.MediaType = detail.MediaType
	}
	ident.TMDBID = detail.ID
	if !ident.Ready() {
		return nil, nil
	}
	return ident, nil
}

func (c *Client) runTool(name, rawArgs string) (string, error) {
	var args map[string]any
	if strings.TrimSpace(rawArgs) != "" {
		if err := json.Unmarshal([]byte(rawArgs), &args); err != nil {
			return "", err
		}
	}
	if c.TMDB == nil {
		return `{"ok":false,"error":"tmdb.notConfigured"}`, nil
	}
	switch name {
	case "tmdbSearch":
		hits, err := c.TMDB.Search(tmdb.SearchQuery{
			Query:     stringArg(args, "query"),
			MediaType: stringArg(args, "mediaType"),
			Year:      intArg(args, "year"),
			Language:  stringArg(args, "language"),
		})
		if err != nil {
			return "", err
		}
		raw, err := json.Marshal(map[string]any{"ok": true, "results": hits})
		if err != nil {
			return "", err
		}
		return string(raw), nil
	case "tmdbDetails":
		detail, err := c.TMDB.Details(intArg(args, "id"), stringArg(args, "mediaType"), stringArg(args, "language"))
		if err != nil {
			return "", err
		}
		if detail == nil {
			return `{"ok":false,"error":"tmdb.emptyResponse"}`, nil
		}
		raw, err := json.Marshal(map[string]any{"ok": true, "result": detail})
		if err != nil {
			return "", err
		}
		return string(raw), nil
	default:
		return fmt.Sprintf(`{"ok":false,"error":"unknown tool %s"}`, name), nil
	}
}

func (id Identity) Unsupported() bool {
	return id.MediaType == "music" || id.MediaType == "other"
}

func parseIdentityJSON(raw string) *Identity {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	var payload struct {
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
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return nil
	}
	ident := &Identity{
		Title:      firstNonEmpty(payload.Title.CanonicalTitle),
		MediaType:  strings.ToLower(strings.TrimSpace(payload.MediaType)),
		Confidence: payload.Confidence.Overall,
	}
	if payload.Title.ReleaseYear != nil {
		ident.Year = *payload.Title.ReleaseYear
	}
	if payload.Title.SeasonNumber != nil {
		ident.Season = payload.Title.SeasonNumber
	}
	if n := firstEpisode(payload.Title.EpisodeNumbers); n != nil {
		ident.Episode = n
	}
	if payload.Series != nil {
		if ident.Season == nil && payload.Series.SeasonNumber != nil {
			ident.Season = payload.Series.SeasonNumber
		}
		if ident.Episode == nil {
			ident.Episode = firstEpisode(payload.Series.EpisodeNumbers)
		}
	}
	if payload.TMDB != nil {
		ident.TMDBID = payload.TMDB.ID
		ident.Title = firstNonEmpty(ident.Title, payload.TMDB.Title)
		if ident.MediaType == "" {
			ident.MediaType = strings.ToLower(strings.TrimSpace(payload.TMDB.MediaType))
		}
		if ident.Year == 0 && len(payload.TMDB.ReleaseDate) >= 4 {
			if year, err := strconv.Atoi(payload.TMDB.ReleaseDate[:4]); err == nil {
				ident.Year = year
			}
		}
	}
	if payload.Confidence.TMDBMatch != nil && *payload.Confidence.TMDBMatch > ident.Confidence {
		ident.Confidence = *payload.Confidence.TMDBMatch
	}
	if ident.Title == "" && ident.TMDBID == 0 {
		return nil
	}
	return ident
}

func firstEpisode(values []int) *int {
	for _, value := range values {
		if value >= 0 {
			n := value
			return &n
		}
	}
	return nil
}

func chatTools() []ChatTool {
	return []ChatTool{
		{
			Type: "function",
			Function: ChatToolFnSpec{
				Name:        "tmdbSearch",
				Description: "Search TMDB for candidate id, titles, year, and rating. Call tmdbDetails for overview and season counts.",
				Parameters:  json.RawMessage(tmdbSearchParams),
			},
		},
		{
			Type: "function",
			Function: ChatToolFnSpec{
				Name:        "tmdbDetails",
				Description: "Fetch detailed TMDB metadata for a candidate id.",
				Parameters:  json.RawMessage(tmdbDetailsParams),
			},
		},
		{
			Type: "function",
			Function: ChatToolFnSpec{
				Name:        "submitMetadata",
				Description: "Submit the final structured identity. Call exactly once as the last action.",
				Parameters:  json.RawMessage(submitMetadataParams),
			},
		},
	}
}

func toolMessage(id, content string) ChatMessage {
	return ChatMessage{Role: "tool", ToolCallID: id, Content: content}
}

func stringArg(args map[string]any, key string) string {
	if args == nil {
		return ""
	}
	value, ok := args[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	default:
		return strings.TrimSpace(fmt.Sprint(typed))
	}
}

func intArg(args map[string]any, key string) int {
	if args == nil {
		return 0
	}
	value, ok := args[key]
	if !ok || value == nil {
		return 0
	}
	switch typed := value.(type) {
	case float64:
		return int(typed)
	case int:
		return typed
	case json.Number:
		n, _ := typed.Int64()
		return int(n)
	case string:
		n, _ := strconv.Atoi(strings.TrimSpace(typed))
		return n
	default:
		n, _ := strconv.Atoi(strings.TrimSpace(fmt.Sprint(typed)))
		return n
	}
}

func userPrompt(request Request) string {
	files := request.Files
	if len(files) > maxFiles {
		files = files[:maxFiles]
	}
	season := ""
	if request.Season != nil {
		season = strconv.Itoa(*request.Season)
	}
	episode := ""
	if request.Episode != nil {
		episode = strconv.Itoa(*request.Episode)
	}
	var b strings.Builder
	b.WriteString("INPUT:\n")
	b.WriteString("- Torrent release name: " + request.TorrentName + "\n")
	b.WriteString("- Parsed title: " + request.ParsedTitle + "\n")
	b.WriteString("- Parsed year: " + strconv.Itoa(request.ParsedYear) + "\n")
	b.WriteString("- Parsed kind: " + request.ParsedKind + "\n")
	b.WriteString("- Parsed season: " + season + "\n")
	b.WriteString("- Parsed episode: " + episode + "\n")
	b.WriteString("- File list:\n")
	if len(files) == 0 {
		b.WriteString("N/A")
	} else {
		b.WriteString(strings.Join(files, "\n"))
	}
	return b.String()
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

const systemPrompt = `You identify a torrent release for library placement. Write titles in zh-CN. Be concise and deterministic.

Workflow:
1. Parse the release name and file list for title, year, SxxEyy, and technical tags.
2. Call tmdbSearch, then tmdbDetails on the best movie/tv candidate.
3. Prefer tool results over guesses. Never invent a TMDB id.
4. Finish by calling submitMetadata exactly once with title, year, season/episode, mediaType, tmdb id, and confidence.

Classify mediaType as movie, tv, anime, music, or other. Include tmdb only for a confirmed match. No web search. Do not emit assistant text.`

const tmdbSearchParams = `{
  "type": "object",
  "properties": {
    "query": {"type": "string"},
    "year": {"type": "integer"},
    "mediaType": {"type": "string", "enum": ["movie", "tv"]},
    "language": {"type": "string"}
  },
  "required": ["query"]
}`

const tmdbDetailsParams = `{
  "type": "object",
  "properties": {
    "id": {"type": "integer"},
    "mediaType": {"type": "string", "enum": ["movie", "tv"]},
    "language": {"type": "string"}
  },
  "required": ["id", "mediaType"]
}`

const submitMetadataParams = `{
  "type": "object",
  "properties": {
    "mediaType": {"type": "string", "enum": ["movie", "tv", "anime", "music", "other"]},
    "title": {
      "type": "object",
      "properties": {
        "canonicalTitle": {"type": "string"},
        "releaseYear": {"type": ["integer", "null"]},
        "seasonNumber": {"type": ["integer", "null"]},
        "episodeNumbers": {"type": "array", "items": {"type": "integer"}}
      },
      "required": ["canonicalTitle"]
    },
    "series": {
      "type": "object",
      "properties": {
        "seasonNumber": {"type": ["integer", "null"]},
        "episodeNumbers": {"type": "array", "items": {"type": "integer"}}
      }
    },
    "tmdb": {
      "type": "object",
      "properties": {
        "id": {"type": "integer"},
        "mediaType": {"type": "string", "enum": ["movie", "tv", "anime"]},
        "title": {"type": "string"},
        "releaseDate": {"type": ["string", "null"]}
      },
      "required": ["id", "mediaType", "title"]
    },
    "confidence": {
      "type": "object",
      "properties": {
        "overall": {"type": "number", "minimum": 0, "maximum": 1},
        "tmdbMatch": {"type": ["number", "null"]}
      },
      "required": ["overall"]
    }
  },
  "required": ["mediaType", "title", "confidence"]
}`
