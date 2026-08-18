package analyze_test

import (
	"context"
	"strings"
	"sync"
	"testing"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/analyze"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/tmdb"
)

func profileWith(t *testing.T, records map[string]string) *store.ProfileStore {
	t.Helper()
	profile := store.NewProfileStore(t.TempDir())
	if len(records) == 0 {
		return profile
	}
	mutations := make([]store.ProfileMutation, 0, len(records))
	for key, value := range records {
		mutations = append(mutations, store.ProfileMutation{Operation: "set", Key: key, Value: value, Secret: strings.Contains(key, "apiKey")})
	}
	if _, err := profile.Apply(0, "test", mutations); err != nil {
		t.Fatal(err)
	}
	return profile
}

func TestSelectProviderPrefersOpenAIThenOpenRouterSkipsCodex(t *testing.T) {
	if got := analyze.SelectProvider(profileWith(t, map[string]string{
		"ai.openai.apiKey":     "oa",
		"ai.openai.model":      "gpt-test",
		"ai.openrouter.apiKey": "or",
		"ai.codex.model":       "codex",
	})); got == nil || got.ID != "openai" || got.Model != "gpt-test" || got.BaseURL != analyze.DefaultOpenAIBaseURL {
		t.Fatalf("%+v", got)
	}
	if got := analyze.SelectProvider(profileWith(t, map[string]string{
		"ai.openrouter.apiKey": "or",
		"ai.codex.model":       "codex",
	})); got == nil || got.ID != "openrouter" || got.Model != analyze.DefaultOpenRouterModel {
		t.Fatalf("%+v", got)
	}
	if got := analyze.SelectProvider(profileWith(t, map[string]string{
		"ai.codex.model": "codex",
	})); got != nil {
		t.Fatalf("%+v", got)
	}
}

func tmdbFetch(rawURL string) ([]byte, error) {
	switch {
	case strings.Contains(rawURL, "/search/movie"):
		return []byte(`{"results":[{"id":603,"title":"The Matrix","original_title":"The Matrix","release_date":"1999-03-31"}]}`), nil
	case strings.Contains(rawURL, "/movie/603"):
		return []byte(`{"id":603,"title":"The Matrix","original_title":"The Matrix","release_date":"1999-03-31","overview":"A hacker."}`), nil
	default:
		return []byte(`{"results":[]}`), nil
	}
}

type scriptedModel struct {
	mu    sync.Mutex
	steps [][]schema.ToolCall
	i     int
	tools []string
}

func (m *scriptedModel) Generate(_ context.Context, _ []*schema.Message, _ ...model.Option) (*schema.Message, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.i >= len(m.steps) {
		return schema.AssistantMessage("", nil), nil
	}
	calls := m.steps[m.i]
	m.i++
	return schema.AssistantMessage("", calls), nil
}

func (m *scriptedModel) Stream(ctx context.Context, in []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	msg, err := m.Generate(ctx, in, opts...)
	if err != nil {
		return nil, err
	}
	return schema.StreamReaderFromArray([]*schema.Message{msg}), nil
}

func (m *scriptedModel) WithTools(tools []*schema.ToolInfo) (model.ToolCallingChatModel, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.tools = make([]string, 0, len(tools))
	for _, item := range tools {
		m.tools = append(m.tools, item.Name)
	}
	return m, nil
}

func fnCall(id, name, args string) schema.ToolCall {
	return schema.ToolCall{ID: id, Type: "function", Function: schema.FunctionCall{Name: name, Arguments: args}}
}

func TestIdentifyWebSearchThenCleanTmdb(t *testing.T) {
	const messy = "www.Site.com.The.Matrix.1999.1080p.BluRay.x264-GROUP"
	var tmdbQueries []string
	usedWeb := false
	script := &scriptedModel{steps: [][]schema.ToolCall{
		{fnCall("call-web", "webSearch", `{"query":"The Matrix 1999 film"}`)},
		{fnCall("call-tmdb", "tmdbSearch", `{"query":"The Matrix","year":1999,"mediaType":"movie"}`)},
		{fnCall("call-submit", "submitMetadata", `{"mediaType":"movie","title":{"canonicalTitle":"黑客帝国","releaseYear":1999},"tmdb":{"id":603,"mediaType":"movie","title":"The Matrix","releaseDate":"1999-03-31"},"confidence":{"overall":0.94}}`)},
	}}
	client := &analyze.Client{
		Provider: analyze.Provider{ID: "openai", APIKey: "k", Model: "m"},
		Model:    script,
		TMDB: tmdb.New("k", func(rawURL string) ([]byte, error) {
			if strings.Contains(rawURL, "/search/") {
				tmdbQueries = append(tmdbQueries, rawURL)
				lower := strings.ToLower(rawURL)
				if strings.Contains(lower, "www") || strings.Contains(lower, "1080p") || strings.Contains(lower, "bluray") || strings.Contains(lower, "site.com") {
					t.Fatalf("tmdb searched raw release: %s", rawURL)
				}
			}
			return tmdbFetch(rawURL)
		}),
		WebSearch: func(_ context.Context, query string, _ int) ([]analyze.WebHit, error) {
			usedWeb = true
			if query == "" {
				t.Fatal("empty web query")
			}
			return []analyze.WebHit{{
				Title:   "The Matrix (1999 film)",
				URL:     "https://en.wikipedia.org/wiki/The_Matrix",
				Snippet: "A computer hacker learns about the true nature of reality.",
			}}, nil
		},
	}
	got, err := client.Identify(context.Background(), analyze.Request{
		TorrentName: messy,
		Files:       []string{messy + ".mkv"},
		ParsedTitle: "www Site com The Matrix",
		ParsedYear:  1999,
		ParsedKind:  "movie",
	})
	if err != nil || got == nil || !got.Ready() || got.TMDBID != 603 || got.Title != "The Matrix" {
		t.Fatalf("%+v %v", got, err)
	}
	if !usedWeb || len(tmdbQueries) == 0 {
		t.Fatalf("usedWeb=%v tmdbQueries=%v", usedWeb, tmdbQueries)
	}
	joined := strings.Join(script.tools, ",")
	if !strings.Contains(joined, "webSearch") || !strings.Contains(joined, "tmdbSearch") || !strings.Contains(joined, "submitMetadata") {
		t.Fatalf("tools=%v", script.tools)
	}
}

func TestIdentifyRejectsLowConfidence(t *testing.T) {
	client := &analyze.Client{
		Provider: analyze.Provider{ID: "openai", APIKey: "k", Model: "m"},
		Model: &scriptedModel{steps: [][]schema.ToolCall{{
			fnCall("call-submit", "submitMetadata", `{"mediaType":"movie","title":{"canonicalTitle":"Maybe"},"tmdb":{"id":603,"mediaType":"movie","title":"The Matrix"},"confidence":{"overall":0.4}}`),
		}}},
		TMDB: tmdb.New("k", tmdbFetch),
	}
	got, err := client.Identify(context.Background(), analyze.Request{TorrentName: "Maybe.1999"})
	if err != nil || got != nil {
		t.Fatalf("%+v %v", got, err)
	}
}

func TestIdentifySkipsWhenNoKey(t *testing.T) {
	client := &analyze.Client{}
	got, err := client.Identify(context.Background(), analyze.Request{TorrentName: "x"})
	if err != nil || got != nil {
		t.Fatalf("%+v %v", got, err)
	}
}
