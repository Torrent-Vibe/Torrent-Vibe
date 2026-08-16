package outbound

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"golang.org/x/net/proxy"
)

func Parse(raw string) (*url.URL, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("invalid proxy url")
	}
	switch strings.ToLower(parsed.Scheme) {
	case "http", "https", "socks5", "socks5h":
		return parsed, nil
	default:
		return nil, fmt.Errorf("unsupported proxy scheme")
	}
}

func NewClient(raw string) (*http.Client, error) {
	parsed, err := Parse(raw)
	if err != nil {
		return nil, err
	}
	if parsed == nil {
		return &http.Client{Transport: http.DefaultTransport}, nil
	}
	transport, err := transportFor(parsed)
	if err != nil {
		return nil, err
	}
	return &http.Client{Transport: transport}, nil
}

func transportFor(parsed *url.URL) (*http.Transport, error) {
	switch strings.ToLower(parsed.Scheme) {
	case "http", "https":
		return &http.Transport{Proxy: http.ProxyURL(parsed)}, nil
	case "socks5", "socks5h":
		dialer, err := proxy.FromURL(parsed, proxy.Direct)
		if err != nil {
			return nil, err
		}
		contextDialer, ok := dialer.(proxy.ContextDialer)
		if !ok {
			return &http.Transport{
				Dial: dialer.Dial,
			}, nil
		}
		return &http.Transport{
			DialContext: contextDialer.DialContext,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported proxy scheme")
	}
}
