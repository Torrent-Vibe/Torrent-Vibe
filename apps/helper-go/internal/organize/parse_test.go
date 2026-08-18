package organize_test

import (
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/organize"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/qb"
)

func TestParseMovieYear(t *testing.T) {
	got := organize.Parse("The.Matrix.1999.1080p.BluRay.x264", []qb.File{
		{Name: "The.Matrix.1999.1080p.BluRay.x264.mkv", Size: 10},
	})
	if got.Kind != organize.KindMovie || got.Year != 1999 || got.Title == "" {
		t.Fatalf("%+v", got)
	}
	if got.Episode != nil {
		t.Fatalf("movie should not have episode: %+v", got)
	}
}

func TestParseTvEpisode(t *testing.T) {
	got := organize.Parse("Show.Name.S01E02.1080p.WEB-DL", nil)
	if got.Kind != organize.KindTV || got.Season == nil || *got.Season != 1 || got.Episode == nil || *got.Episode != 2 {
		t.Fatalf("%+v", got)
	}
}

func TestParseAnimeEpisode(t *testing.T) {
	got := organize.Parse("[SubsPlease] 葬送的芙莉莲 - 28 (1080p)", []qb.File{
		{Name: "[SubsPlease] 葬送的芙莉莲 - 28 (1080p).mkv", Size: 8},
	})
	if got.Kind != organize.KindAnime || got.Episode == nil || *got.Episode != 28 {
		t.Fatalf("%+v", got)
	}
}

func TestParseCollection(t *testing.T) {
	got := organize.Parse("[组] 葬送的芙莉莲 [01-28 合集][1080p]", nil)
	if got.Kind != organize.KindCollection {
		t.Fatalf("%+v", got)
	}
}

func TestParseMusic(t *testing.T) {
	got := organize.Parse("Album", []qb.File{
		{Name: "01 Track.flac", Size: 20},
		{Name: "02 Track.flac", Size: 21},
	})
	if got.Kind != organize.KindMusic {
		t.Fatalf("%+v", got)
	}
}

func TestParseSkipsSample(t *testing.T) {
	got := organize.Parse("Movie.2020", []qb.File{
		{Name: "Movie.2020.mkv", Size: 100},
		{Name: "Movie.2020.sample.mkv", Size: 1},
	})
	if got.Kind != organize.KindMovie || got.Year != 2020 {
		t.Fatalf("%+v", got)
	}
}
