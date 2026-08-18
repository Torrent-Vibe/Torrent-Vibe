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

func TestSearchUniqueMovie(t *testing.T) {
	client := tmdb.New("k", func(rawURL string) ([]byte, error) {
		if !strings.Contains(rawURL, "/search/movie") {
			t.Fatal(rawURL)
		}
		return []byte(`{"results":[{"id":603,"title":"The Matrix","original_title":"The Matrix","release_date":"1999-03-31"}]}`), nil
	})
	got, err := client.SearchUniqueMovie("The Matrix")
	if err != nil || got == nil || got.ID != 603 || got.Year != 1999 {
		t.Fatalf("%+v %v", got, err)
	}
}

func TestSearchUniqueMovieTwoHits(t *testing.T) {
	client := tmdb.New("k", func(string) ([]byte, error) {
		return []byte(`{"results":[{"id":1,"title":"The Matrix"},{"id":2,"title":"The Matrix Reloaded"}]}`), nil
	})
	got, err := client.SearchUniqueMovie("The Matrix")
	if err != nil || got != nil {
		t.Fatalf("%+v %v", got, err)
	}
}

func TestSearchAndDetails(t *testing.T) {
	var urls []string
	client := tmdb.New("k", func(rawURL string) ([]byte, error) {
		urls = append(urls, rawURL)
		if strings.Contains(rawURL, "/search/movie") {
			return []byte(`{"results":[{"id":603,"title":"The Matrix","original_title":"The Matrix","release_date":"1999-03-31"}]}`), nil
		}
		if strings.Contains(rawURL, "/movie/603") {
			return []byte(`{"id":603,"title":"The Matrix","release_date":"1999-03-31","overview":"A hacker.","runtime":136}`), nil
		}
		t.Fatal(rawURL)
		return nil, errors.New(rawURL)
	})
	hits, err := client.Search(tmdb.SearchQuery{Query: "The Matrix", MediaType: "movie", Year: 1999})
	if err != nil || len(hits) != 1 || hits[0].ID != 603 || hits[0].Year != 1999 {
		t.Fatalf("%+v %v", hits, err)
	}
	detail, err := client.Details(603, "movie", "")
	if err != nil || detail == nil || detail.Overview == "" || detail.MediaType != "movie" {
		t.Fatalf("%+v %v", detail, err)
	}
	if !strings.Contains(urls[0], "year=1999") {
		t.Fatalf("%v", urls)
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
