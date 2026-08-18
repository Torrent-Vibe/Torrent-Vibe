package analyze

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type ChatRequest struct {
	Model      string        `json:"model"`
	Messages   []ChatMessage `json:"messages"`
	Tools      []ChatTool    `json:"tools,omitempty"`
	ToolChoice any           `json:"tool_choice,omitempty"`
}

type ChatMessage struct {
	Role       string     `json:"role"`
	Content    string     `json:"content,omitempty"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
}

type ToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type ChatTool struct {
	Type     string         `json:"type"`
	Function ChatToolFnSpec `json:"function"`
}

type ChatToolFnSpec struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

type ChatChoice struct {
	FinishReason string      `json:"finish_reason"`
	Message      ChatMessage `json:"message"`
}

type ChatError struct {
	Message string `json:"message"`
}

type ChatResponse struct {
	Choices []ChatChoice `json:"choices"`
	Error   *ChatError   `json:"error"`
}

type PostJSON func(ctx context.Context, rawURL string, headers map[string]string, body []byte) ([]byte, error)

func HTTPChat(post PostJSON, provider Provider) func(context.Context, ChatRequest) (ChatResponse, error) {
	return func(ctx context.Context, request ChatRequest) (ChatResponse, error) {
		if post == nil {
			return ChatResponse{}, fmt.Errorf("missing chat transport")
		}
		raw, err := json.Marshal(request)
		if err != nil {
			return ChatResponse{}, err
		}
		headers := map[string]string{
			"authorization": "Bearer " + provider.APIKey,
			"content-type":  "application/json",
			"accept":        "application/json",
		}
		if provider.ID == "openrouter" {
			headers["http-referer"] = "https://torrent-vibe.app"
			headers["x-title"] = "Torrent Vibe"
		}
		body, err := post(ctx, chatURL(provider.BaseURL), headers, raw)
		if err != nil {
			return ChatResponse{}, err
		}
		var response ChatResponse
		if err := json.Unmarshal(body, &response); err != nil {
			return ChatResponse{}, err
		}
		if response.Error != nil && strings.TrimSpace(response.Error.Message) != "" {
			return ChatResponse{}, fmt.Errorf("%s", response.Error.Message)
		}
		if len(response.Choices) == 0 {
			return ChatResponse{}, fmt.Errorf("empty chat response")
		}
		return response, nil
	}
}

func PostJSONWithClient(client *http.Client) PostJSON {
	return func(ctx context.Context, rawURL string, headers map[string]string, body []byte) ([]byte, error) {
		if client == nil {
			client = http.DefaultClient
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, rawURL, bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("user-agent", "torrent-vibe-helper/0.0.1")
		for key, value := range headers {
			req.Header.Set(key, value)
		}
		res, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		defer res.Body.Close()
		raw, err := io.ReadAll(res.Body)
		if err != nil {
			return nil, err
		}
		if res.StatusCode >= 400 {
			return nil, fmt.Errorf("http %d", res.StatusCode)
		}
		return raw, nil
	}
}

func chatURL(base string) string {
	return strings.TrimRight(strings.TrimSpace(base), "/") + "/chat/completions"
}
