package analyze_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

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

func submitCall(args string) analyze.ToolCall {
	var call analyze.ToolCall
	call.ID = "call-submit"
	call.Type = "function"
	call.Function.Name = "submitMetadata"
	call.Function.Arguments = args
	return call
}

func TestIdentifyUsesTmdbToolsThenSubmit(t *testing.T) {
	var turns []analyze.ChatRequest
	client := &analyze.Client{
		Provider: analyze.Provider{ID: "openai", APIKey: "k", Model: "m", BaseURL: analyze.DefaultOpenAIBaseURL},
		TMDB:     tmdb.New("k", tmdbFetch),
		Chat: func(_ context.Context, request analyze.ChatRequest) (analyze.ChatResponse, error) {
			turns = append(turns, request)
			if len(turns) == 1 {
				var call analyze.ToolCall
				call.ID = "call-search"
				call.Type = "function"
				call.Function.Name = "tmdbSearch"
				call.Function.Arguments = `{"query":"The Matrix","year":1999,"mediaType":"movie"}`
				return analyze.ChatResponse{Choices: []analyze.ChatChoice{{
					FinishReason: "tool_calls",
					Message:      analyze.ChatMessage{Role: "assistant", ToolCalls: []analyze.ToolCall{call}},
				}}}, nil
			}
			return analyze.ChatResponse{Choices: []analyze.ChatChoice{{
				FinishReason: "tool_calls",
				Message: analyze.ChatMessage{Role: "assistant", ToolCalls: []analyze.ToolCall{
					submitCall(`{"mediaType":"movie","title":{"canonicalTitle":"黑客帝国","releaseYear":1999},"tmdb":{"id":603,"mediaType":"movie","title":"The Matrix","releaseDate":"1999-03-31"},"confidence":{"overall":0.94}}`),
				}},
			}}}, nil
		},
	}
	got, err := client.Identify(context.Background(), analyze.Request{
		TorrentName: "www.Site.com.The.Matrix.1999.1080p.BluRay.x264-GROUP",
		Files:       []string{"www.Site.com.The.Matrix.1999.1080p.BluRay.x264-GROUP.mkv"},
		ParsedTitle: "www Site com The Matrix",
		ParsedYear:  1999,
		ParsedKind:  "movie",
	})
	if err != nil || got == nil || !got.Ready() || got.TMDBID != 603 || got.Title != "The Matrix" || got.Year != 1999 {
		t.Fatalf("%+v %v", got, err)
	}
	if len(turns) != 2 {
		t.Fatalf("turns=%d", len(turns))
	}
	if !strings.Contains(turns[1].Messages[len(turns[1].Messages)-1].Content, `"id":603`) {
		t.Fatalf("search tool result missing: %+v", turns[1].Messages)
	}
}

func TestIdentifyRejectsLowConfidence(t *testing.T) {
	client := &analyze.Client{
		Provider: analyze.Provider{ID: "openai", APIKey: "k", Model: "m"},
		TMDB:     tmdb.New("k", tmdbFetch),
		Chat: func(context.Context, analyze.ChatRequest) (analyze.ChatResponse, error) {
			return analyze.ChatResponse{Choices: []analyze.ChatChoice{{
				Message: analyze.ChatMessage{Role: "assistant", ToolCalls: []analyze.ToolCall{
					submitCall(`{"mediaType":"movie","title":{"canonicalTitle":"Maybe"},"tmdb":{"id":603,"mediaType":"movie","title":"The Matrix"},"confidence":{"overall":0.4}}`),
				}},
			}}}, nil
		},
	}
	got, err := client.Identify(context.Background(), analyze.Request{TorrentName: "Maybe.1999"})
	if err != nil || got != nil {
		t.Fatalf("%+v %v", got, err)
	}
}

func TestIdentifySkipsWhenNoKey(t *testing.T) {
	called := false
	client := &analyze.Client{
		Chat: func(context.Context, analyze.ChatRequest) (analyze.ChatResponse, error) {
			called = true
			return analyze.ChatResponse{}, nil
		},
	}
	got, err := client.Identify(context.Background(), analyze.Request{TorrentName: "x"})
	if err != nil || got != nil || called {
		t.Fatalf("%+v %v called=%v", got, err, called)
	}
}

func TestHTTPChatPostsCompletions(t *testing.T) {
	var sawURL string
	var sawAuth string
	chat := analyze.HTTPChat(func(_ context.Context, rawURL string, headers map[string]string, body []byte) ([]byte, error) {
		sawURL = rawURL
		sawAuth = headers["authorization"]
		var req analyze.ChatRequest
		if err := json.Unmarshal(body, &req); err != nil {
			t.Fatal(err)
		}
		if req.Model != "gpt-test" {
			t.Fatalf("%+v", req)
		}
		return []byte(`{"choices":[{"message":{"role":"assistant","content":""}}]}`), nil
	}, analyze.Provider{ID: "openai", APIKey: "secret", BaseURL: "https://api.openai.com/v1", Model: "gpt-test"})
	got, err := chat(context.Background(), analyze.ChatRequest{Model: "gpt-test"})
	if err != nil || len(got.Choices) != 1 {
		t.Fatalf("%+v %v", got, err)
	}
	if sawURL != "https://api.openai.com/v1/chat/completions" || sawAuth != "Bearer secret" {
		t.Fatalf("url=%s auth=%s", sawURL, sawAuth)
	}
}
