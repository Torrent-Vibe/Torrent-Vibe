package analyze

import (
	"strings"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

const (
	DefaultOpenAIModel     = "gpt-5-nano"
	DefaultOpenAIBaseURL   = "https://api.openai.com/v1"
	DefaultOpenRouterModel = "openrouter/auto"
	DefaultOpenRouterURL   = "https://openrouter.ai/api/v1"
)

type Provider struct {
	ID      string
	APIKey  string
	BaseURL string
	Model   string
}

func SelectProvider(profile *store.ProfileStore) *Provider {
	if profile == nil {
		return nil
	}
	if key := strings.TrimSpace(profile.Value("ai.openai.apiKey")); key != "" {
		base := strings.TrimSpace(profile.Value("ai.openai.baseUrl"))
		if base == "" {
			base = DefaultOpenAIBaseURL
		}
		model := strings.TrimSpace(profile.Value("ai.openai.model"))
		if model == "" {
			model = DefaultOpenAIModel
		}
		return &Provider{ID: "openai", APIKey: key, BaseURL: base, Model: model}
	}
	if key := strings.TrimSpace(profile.Value("ai.openrouter.apiKey")); key != "" {
		model := strings.TrimSpace(profile.Value("ai.openrouter.model"))
		if model == "" {
			model = DefaultOpenRouterModel
		}
		return &Provider{ID: "openrouter", APIKey: key, BaseURL: DefaultOpenRouterURL, Model: model}
	}
	return nil
}
