package bangumi_test

import (
	"testing"
	"time"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/bangumi"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
)

func TestMatchUniqueAirdate(t *testing.T) {
	parsed := mikan.ParsedTitle{Title: "X"}
	item := mikan.RssEpisode{PublishedAt: "2024-03-22T12:00:00Z"}
	got := bangumi.Match(parsed, item, []bangumi.Episode{
		{Sort: 28, AirDate: "2024-03-22", Name: "e28"},
		{Sort: 27, AirDate: "2024-03-15", Name: "e27"},
	})
	if got.Episode == nil || *got.Episode != 28 {
		t.Fatalf("%+v", got)
	}
}

func TestMatchPackDoesNotUniqueMatch(t *testing.T) {
	parsed := mikan.ParsedTitle{Title: "X"}
	item := mikan.RssEpisode{PublishedAt: "2024-03-22T12:00:00Z"}
	got := bangumi.Match(parsed, item, []bangumi.Episode{
		{Sort: 1, AirDate: "2024-03-22"},
		{Sort: 2, AirDate: "2024-03-22"},
	})
	if got.Episode != nil {
		t.Fatalf("%+v", got)
	}
}

func TestEpisodesCachesBySubject(t *testing.T) {
	hits := 0
	c := bangumi.New(func(string) ([]byte, error) {
		hits++
		return []byte(`{"data":[{"sort":1,"airdate":"2024-01-01","name":"a"}]}`), nil
	}, func() time.Time { return time.Unix(0, 0) })
	if _, err := c.Episodes("123"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Episodes("123"); err != nil {
		t.Fatal(err)
	}
	if hits != 1 {
		t.Fatalf("hits=%d", hits)
	}
}
