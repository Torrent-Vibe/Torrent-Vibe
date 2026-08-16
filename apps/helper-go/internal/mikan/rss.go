package mikan

import (
	"regexp"
	"strconv"
	"strings"
)

type RssEpisode struct {
	EpisodeID   string `json:"episodeId"`
	Title       string `json:"title"`
	TorrentURL  string `json:"torrentUrl"`
	PublishedAt string `json:"publishedAt,omitempty"`
	SizeBytes   int64  `json:"sizeBytes,omitempty"`
}

var (
	reItem        = regexp.MustCompile(`(?is)<item\b[^>]*>.*?</item>`)
	reEnclosure   = regexp.MustCompile(`(?i)<enclosure\b[^>]*>`)
	reEpisodePage = regexp.MustCompile(`(?i)/Home/Episode/([a-f0-9]+)`)
	reEpisodeDL   = regexp.MustCompile(`(?i)/Download/\d+/([a-f0-9]+)\.torrent`)
	reHexEntity   = regexp.MustCompile(`&#x([0-9a-fA-F]+);`)
	reDecEntity   = regexp.MustCompile(`&#(\d+);`)
)

func ParseBangumiRSS(xml, baseURL string) []RssEpisode {
	items := reItem.FindAllString(xml, -1)
	episodes := make([]RssEpisode, 0, len(items))
	for _, item := range items {
		title := tagText(item, "title")
		pageLink := tagText(item, "link")
		enclosureTag := ""
		if match := reEnclosure.FindString(item); match != "" {
			enclosureTag = match
		}
		enclosureURL := attr(enclosureTag, "url")
		episodeID := ""
		if match := reEpisodePage.FindStringSubmatch(pageLink); match != nil {
			episodeID = match[1]
		} else if match := reEpisodeDL.FindStringSubmatch(enclosureURL); match != nil {
			episodeID = match[1]
		}
		torrentHref := enclosureURL
		if torrentHref == "" {
			torrentHref = pageLink
		}
		if title == "" || episodeID == "" || torrentHref == "" {
			continue
		}
		episode := RssEpisode{
			EpisodeID:  episodeID,
			Title:      title,
			TorrentURL: TorrentDownloadURL(baseURL, torrentHref),
		}
		if published := tagText(item, "pubDate"); published != "" {
			episode.PublishedAt = published
		}
		sizeRaw := tagText(item, "contentLength")
		if sizeRaw == "" {
			sizeRaw = attr(enclosureTag, "length")
		}
		if size, err := strconv.ParseInt(sizeRaw, 10, 64); err == nil && size > 0 {
			episode.SizeBytes = size
		}
		episodes = append(episodes, episode)
	}
	return episodes
}

func tagText(xml, name string) string {
	re := regexp.MustCompile(`(?is)<` + regexp.QuoteMeta(name) + `(?:\s[^>]*)?>(.*?)</` + regexp.QuoteMeta(name) + `>`)
	match := re.FindStringSubmatch(xml)
	if match == nil {
		return ""
	}
	return decodeXML(match[1])
}

func attr(tag, name string) string {
	if tag == "" {
		return ""
	}
	re := regexp.MustCompile(`(?i)` + regexp.QuoteMeta(name) + `\s*=\s*"([^"]*)"`)
	if match := re.FindStringSubmatch(tag); match != nil {
		return decodeXML(match[1])
	}
	re = regexp.MustCompile(`(?i)` + regexp.QuoteMeta(name) + `\s*=\s*'([^']*)'`)
	if match := re.FindStringSubmatch(tag); match != nil {
		return decodeXML(match[1])
	}
	return ""
}

func decodeXML(value string) string {
	out := reHexEntity.ReplaceAllStringFunc(value, func(match string) string {
		sub := reHexEntity.FindStringSubmatch(match)
		n, err := strconv.ParseInt(sub[1], 16, 32)
		if err != nil {
			return match
		}
		return string(rune(n))
	})
	out = reDecEntity.ReplaceAllStringFunc(out, func(match string) string {
		sub := reDecEntity.FindStringSubmatch(match)
		n, err := strconv.ParseInt(sub[1], 10, 32)
		if err != nil {
			return match
		}
		return string(rune(n))
	})
	out = strings.ReplaceAll(out, "&nbsp;", " ")
	out = strings.ReplaceAll(out, "&quot;", `"`)
	out = strings.ReplaceAll(out, "&apos;", "'")
	out = strings.ReplaceAll(out, "&lt;", "<")
	out = strings.ReplaceAll(out, "&gt;", ">")
	out = strings.ReplaceAll(out, "&amp;", "&")
	return out
}
