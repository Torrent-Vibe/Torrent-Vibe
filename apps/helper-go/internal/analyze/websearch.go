package analyze

import (
	"context"
	"html"
	"net/url"
	"regexp"
	"strings"
)

type WebHit struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
}

func (c *Client) searchWeb(ctx context.Context, query string, maxResults int) ([]WebHit, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, nil
	}
	if maxResults <= 0 {
		maxResults = 5
	}
	if maxResults > 8 {
		maxResults = 8
	}
	if c.WebSearch != nil {
		return c.WebSearch(ctx, query, maxResults)
	}
	if c.Get == nil {
		return nil, nil
	}
	raw, err := c.Get("https://html.duckduckgo.com/html/?q=" + url.QueryEscape(query))
	if err != nil {
		return nil, err
	}
	return parseDuckDuckGoHTML(string(raw), maxResults), nil
}

var (
	ddgResult  = regexp.MustCompile(`(?is)<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>`)
	ddgSnippet = regexp.MustCompile(`(?is)<(?:a|td)[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</(?:a|td)>`)
	htmlTag    = regexp.MustCompile(`<[^>]+>`)
)

func parseDuckDuckGoHTML(raw string, limit int) []WebHit {
	links := ddgResult.FindAllStringSubmatch(raw, limit*2)
	snippets := ddgSnippet.FindAllStringSubmatch(raw, limit*2)
	hits := make([]WebHit, 0, limit)
	for i, link := range links {
		if len(hits) >= limit {
			break
		}
		href := decodeDuckDuckGoURL(html.UnescapeString(link[1]))
		title := compactText(link[2])
		if href == "" || title == "" {
			continue
		}
		snippet := ""
		if i < len(snippets) {
			snippet = compactText(snippets[i][1])
		}
		hits = append(hits, WebHit{Title: title, URL: href, Snippet: snippet})
	}
	return hits
}

func decodeDuckDuckGoURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	if uddg := parsed.Query().Get("uddg"); uddg != "" {
		decoded, err := url.QueryUnescape(uddg)
		if err == nil && decoded != "" {
			return decoded
		}
		return uddg
	}
	if parsed.Scheme == "http" || parsed.Scheme == "https" {
		return raw
	}
	return raw
}

func compactText(raw string) string {
	text := html.UnescapeString(htmlTag.ReplaceAllString(raw, " "))
	return strings.Join(strings.Fields(text), " ")
}
