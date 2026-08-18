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

func toolCall(id, name, args string) analyze.ToolCall {
	var call analyze.ToolCall
	call.ID = id
	call.Type = "function"
	call.Function.Name = name
	call.Function.Arguments = args
	return call
}

func TestIdentifyWebSearchThenCleanTmdb(t *testing.T) {
	const messy = "www.Site.com.The.Matrix.1999.1080p.BluRay.x264-GROUP"
	var turns []analyze.ChatRequest
	var tmdbQueries []string
	usedWeb := false
	client := &analyze.Client{
		Provider: analyze.Provider{ID: "openai", APIKey: "k", Model: "m", BaseURL: analyze.DefaultOpenAIBaseURL},
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
		Chat: func(_ context.Context, request analyze.ChatRequest) (analyze.ChatResponse, error) {
			turns = append(turns, request)
			names := toolNames(request)
			if !containsTool(names, "webSearch") || !containsTool(names, "tmdbSearch") {
				t.Fatalf("tools=%v", names)
			}
			switch len(turns) {
			case 1:
				return analyze.ChatResponse{Choices: []analyze.ChatChoice{{
					FinishReason: "tool_calls",
					Message: analyze.ChatMessage{Role: "assistant", ToolCalls: []analyze.ToolCall{
						toolCall("call-web", "webSearch", `{"query":"The Matrix 1999 film"}`),
					}},
				}}}, nil
			case 2:
				return analyze.ChatResponse{Choices: []analyze.ChatChoice{{
					FinishReason: "tool_calls",
					Message: analyze.ChatMessage{Role: "assistant", ToolCalls: []analyze.ToolCall{
						toolCall("call-tmdb", "tmdbSearch", `{"query":"The Matrix","year":1999,"mediaType":"movie"}`),
					}},
				}}}, nil
			default:
				return analyze.ChatResponse{Choices: []analyze.ChatChoice{{
					FinishReason: "tool_calls",
					Message: analyze.ChatMessage{Role: "assistant", ToolCalls: []analyze.ToolCall{
						submitCall(`{"mediaType":"movie","title":{"canonicalTitle":"黑客帝国","releaseYear":1999},"tmdb":{"id":603,"mediaType":"movie","title":"The Matrix","releaseDate":"1999-03-31"},"confidence":{"overall":0.94}}`),
					}},
				}}}, nil
			}
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
		t.Fatalf("usedWeb=%v tmdbQueries=%v turns=%d", usedWeb, tmdbQueries, len(turns))
	}
}

func toolNames(request analyze.ChatRequest) []string {
	out := make([]string, 0, len(request.Tools))
	for _, tool := range request.Tools {
		out = append(out, tool.Function.Name)
	}
	return out
}

func containsTool(names []string, want string) bool {
	for _, name := range names {
		if name == want {
			return true
		}
	}
	return false
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
