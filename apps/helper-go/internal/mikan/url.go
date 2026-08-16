package mikan

import (
	"net/url"
	"regexp"
	"strings"
)

func withTrailingSlash(baseURL string) string {
	if strings.HasSuffix(baseURL, "/") {
		return baseURL
	}
	return baseURL + "/"
}

var absoluteURL = regexp.MustCompile(`(?i)^https?://`)

func JoinMikanURL(baseURL, path string) string {
	base := withTrailingSlash(baseURL)
	if absoluteURL.MatchString(path) || strings.HasPrefix(path, "//") {
		absolute := path
		if strings.HasPrefix(path, "//") {
			absolute = "https:" + path
		}
		remote, err := url.Parse(absolute)
		if err != nil {
			return path
		}
		resolved, err := url.Parse(base)
		if err != nil {
			return path
		}
		return resolved.ResolveReference(&url.URL{
			Path:     remote.Path,
			RawQuery: remote.RawQuery,
			Fragment: remote.Fragment,
		}).String()
	}
	resolved, err := url.Parse(base)
	if err != nil {
		return path
	}
	ref, err := url.Parse(path)
	if err != nil {
		return path
	}
	return resolved.ResolveReference(ref).String()
}

func BangumiRSSURL(baseURL, bangumiID, subgroupID string) string {
	resolved, err := url.Parse(withTrailingSlash(baseURL))
	if err != nil {
		return ""
	}
	ref, err := url.Parse("RSS/Bangumi")
	if err != nil {
		return ""
	}
	out := resolved.ResolveReference(ref)
	query := out.Query()
	query.Set("bangumiId", bangumiID)
	query.Set("subgroupid", subgroupID)
	out.RawQuery = query.Encode()
	return out.String()
}

func TorrentDownloadURL(baseURL, href string) string {
	return JoinMikanURL(baseURL, href)
}
