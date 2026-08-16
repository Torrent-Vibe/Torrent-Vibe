package tmdb_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/tmdb"
)

func TestResolveSeasonUniquePart(t *testing.T) {
	var urls []string
	client := tmdb.New("k", func(rawURL string) ([]byte, error) {
		urls = append(urls, rawURL)
		if strings.Contains(rawURL, "/search/tv") {
			return []byte(`{"results":[{"id":11,"name":"无职转生","original_name":"Mushoku Tensei"}]}`), nil
		}
		return []byte(`{"seasons":[{"season_number":0,"name":"Specials"},{"season_number":1,"name":"Season 1"},{"season_number":2,"name":"Part 2"}]}`), nil
	})
	ident := mikan.Identify("无职转生Ⅱ 第2部分", "[组] 无职转生 - 05 [1080P]")
	got := client.ResolveSeason(ident)
	if got == nil || *got != 2 || len(urls) != 2 {
		t.Fatalf("got=%v urls=%v ident=%+v", got, urls, ident)
	}
}

func TestResolveSeasonTwoHitsIgnored(t *testing.T) {
	client := tmdb.New("k", func(rawURL string) ([]byte, error) {
		if strings.Contains(rawURL, "/search/tv") {
			return []byte(`{"results":[{"id":1,"name":"无职转生"},{"id":2,"name":"无职转生 第二季"}]}`), nil
		}
		t.Fatal(rawURL)
		return nil, nil
	})
	ident := mikan.Identify("无职转生Ⅱ 第2部分", "[组] 无职转生 - 05 [1080P]")
	if got := client.ResolveSeason(ident); got != nil {
		t.Fatalf("%v", got)
	}
}

func TestResolveSeasonNoKey(t *testing.T) {
	called := false
	client := tmdb.New("", func(string) ([]byte, error) {
		called = true
		return nil, errors.New("no")
	})
	ident := mikan.Identify("无职转生Ⅱ 第2部分", "[组] 无职转生 - 05 [1080P]")
	if got := client.ResolveSeason(ident); got != nil || called {
		t.Fatalf("got=%v called=%v", got, called)
	}
}

func TestResolveSeasonTimeout(t *testing.T) {
	client := tmdb.New("k", func(string) ([]byte, error) {
		return nil, errors.New("timeout")
	})
	ident := mikan.Identify("无职转生Ⅱ 第2部分", "[组] 无职转生 - 05 [1080P]")
	if got := client.ResolveSeason(ident); got != nil {
		t.Fatalf("%v", got)
	}
}

func TestResolveSeasonSkippedWhenClear(t *testing.T) {
	called := false
	client := tmdb.New("k", func(string) ([]byte, error) {
		called = true
		return nil, errors.New("no")
	})
	ident := mikan.Identify("擅长逃跑的殿下 第二季", "[组] - 17 [1080P]")
	if got := client.ResolveSeason(ident); got != nil || called {
		t.Fatalf("got=%v called=%v", got, called)
	}
}
