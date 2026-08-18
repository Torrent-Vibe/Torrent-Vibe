package analyze

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/flow/agent/react"
	"github.com/cloudwego/eino/schema"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/tmdb"
)

const (
	MinConfidence = 0.8
	maxFiles      = 40
	maxAgentSteps = 20
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

func (id Identity) Unsupported() bool {
	return id.MediaType == "music" || id.MediaType == "other"
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
	Provider  Provider
	TMDB      *tmdb.Client
	Get       func(rawURL string) ([]byte, error)
	WebSearch func(ctx context.Context, query string, maxResults int) ([]WebHit, error)
	Model     model.ToolCallingChatModel
	HTTP      *http.Client
}

func New(provider Provider, tmdbClient *tmdb.Client, get func(string) ([]byte, error), httpClient *http.Client) *Client {
	return &Client{
		Provider: provider,
		TMDB:     tmdbClient,
		Get:      get,
		HTTP:     httpClient,
	}
}

func (c *Client) Identify(ctx context.Context, request Request) (*Identity, error) {
	if c == nil {
		return nil, nil
	}
	chatModel, err := c.chatModel(ctx)
	if err != nil || chatModel == nil {
		return nil, err
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, 45*time.Second)
		defer cancel()
	}
	tools, err := c.agentTools()
	if err != nil {
		return nil, err
	}
	agent, err := react.NewAgent(ctx, &react.AgentConfig{
		ToolCallingModel: chatModel,
		ToolsConfig: compose.ToolsNodeConfig{
			Tools: tools,
		},
		MaxStep: maxAgentSteps,
		ToolReturnDirectly: map[string]struct{}{
			"submitMetadata": {},
		},
	})
	if err != nil {
		return nil, err
	}
	out, err := agent.Generate(ctx, []*schema.Message{
		schema.SystemMessage(systemPrompt),
		schema.UserMessage(userPrompt(request)),
	})
	if err != nil {
		return nil, err
	}
	return c.confirm(identityFromAgent(out))
}

func (c *Client) chatModel(ctx context.Context) (model.ToolCallingChatModel, error) {
	if c.Model != nil {
		return c.Model, nil
	}
	if strings.TrimSpace(c.Provider.APIKey) == "" {
		return nil, nil
	}
	cfg := &openai.ChatModelConfig{
		APIKey:     c.Provider.APIKey,
		BaseURL:    c.Provider.BaseURL,
		Model:      c.Provider.Model,
		HTTPClient: c.HTTP,
	}
	if c.Provider.ID == "openrouter" {
		cfg.HTTPClient = withHeaders(c.HTTP, map[string]string{
			"HTTP-Referer": "https://torrent-vibe.app",
			"X-Title":      "Torrent Vibe",
		})
	}
	return openai.NewChatModel(ctx, cfg)
}

func (c *Client) agentTools() ([]tool.BaseTool, error) {
	webSearch, err := utils.InferTool("webSearch", "Search the public web. Returns title, url, and snippet. Use when the cleaned title is still uncertain before calling tmdbSearch.", c.webSearchTool)
	if err != nil {
		return nil, err
	}
	tmdbSearch, err := utils.InferTool("tmdbSearch", "Search TMDB with a cleaned title only. Never pass the raw release name, site prefix, or codec tags.", c.tmdbSearchTool)
	if err != nil {
		return nil, err
	}
	tmdbDetails, err := utils.InferTool("tmdbDetails", "Fetch detailed TMDB metadata for a candidate id.", c.tmdbDetailsTool)
	if err != nil {
		return nil, err
	}
	submit, err := utils.InferTool("submitMetadata", "Submit the final structured identity. Call exactly once as the last action.", c.submitMetadataTool)
	if err != nil {
		return nil, err
	}
	return []tool.BaseTool{webSearch, tmdbSearch, tmdbDetails, submit}, nil
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

func identityFromAgent(msg *schema.Message) *Identity {
	if msg == nil {
		return nil
	}
	if ident := parseIdentityJSON(msg.Content); ident != nil {
		return ident
	}
	for _, call := range msg.ToolCalls {
		if ident := parseIdentityJSON(call.Function.Arguments); ident != nil {
			return ident
		}
	}
	return nil
}

func parseIdentityJSON(raw string) *Identity {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	var payload submitInput
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return nil
	}
	ident := payload.identity()
	if ident.Title == "" && ident.TMDBID == 0 {
		return nil
	}
	return ident
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
	b.WriteString("- Heuristic parse (may still contain site/group/codec junk; do not tmdbSearch this unless it is already a clean title): " + request.ParsedTitle + "\n")
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

func firstEpisode(values []int) *int {
	for _, value := range values {
		if value >= 0 {
			n := value
			return &n
		}
	}
	return nil
}

func withHeaders(base *http.Client, headers map[string]string) *http.Client {
	transport := http.DefaultTransport
	timeout := time.Duration(0)
	if base != nil {
		if base.Transport != nil {
			transport = base.Transport
		}
		timeout = base.Timeout
	}
	return &http.Client{
		Timeout: timeout,
		Transport: headerRoundTripper{
			base:    transport,
			headers: headers,
		},
	}
}

type headerRoundTripper struct {
	base    http.RoundTripper
	headers map[string]string
}

func (t headerRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	clone := req.Clone(req.Context())
	for key, value := range t.headers {
		clone.Header.Set(key, value)
	}
	return t.base.RoundTrip(clone)
}

func toolJSON(value any) string {
	raw, err := json.Marshal(value)
	if err != nil {
		return fmt.Sprintf(`{"ok":false,"error":%q}`, err.Error())
	}
	return string(raw)
}

const systemPrompt = `You identify a torrent release for library placement. Write titles in zh-CN. Be concise and deterministic.

Workflow:
1. Decode the release name and file list. Strip site prefixes (www.*, *.com), group tags, codecs, resolution, source, and other junk. The raw release string is not a title.
2. If the cleaned title is still uncertain, call webSearch with a human query (guessed title, year, or distinctive tokens). Use title/url/snippet results to identify the work.
3. Only then call tmdbSearch with the cleaned title (and year when known). Never pass the raw release name, site prefix, or codec tags to tmdbSearch.
4. Confirm the best candidate with tmdbDetails.
5. Finish by calling submitMetadata exactly once with title, year, season/episode, mediaType, tmdb id, and confidence.

Prefer tool results over guesses. Never invent a TMDB id. Classify mediaType as movie, tv, anime, music, or other. Include tmdb only for a confirmed match. Do not emit assistant text.`
