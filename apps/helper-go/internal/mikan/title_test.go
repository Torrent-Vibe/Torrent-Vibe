package mikan_test

import (
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
)

func TestParseMikanTitleANiDash(t *testing.T) {
	got := mikan.ParseMikanTitle("[ANi] 葬送的芙莉莲 - 28 [1080P]")
	if got.Title != "葬送的芙莉莲" || got.Season != nil || got.Episode == nil || *got.Episode != 28 {
		t.Fatalf("%+v", got)
	}
}

func TestParseMikanTitleRomajiSlash(t *testing.T) {
	got := mikan.ParseMikanTitle("[ANi] Sōsō no Frieren /  葬送的芙莉莲 - 28 [1080P][Baha][WEB-DL][AAC AVC][CHT][MP4]")
	if got.Title != "葬送的芙莉莲" || got.Season != nil || got.Episode == nil || *got.Episode != 28 {
		t.Fatalf("%+v", got)
	}
}

func TestParseMikanTitleMissingEpisode(t *testing.T) {
	got := mikan.ParseMikanTitle("[ANi] 葬送的芙莉莲 [1080P]")
	if got.Title != "葬送的芙莉莲" || got.Season != nil || got.Episode != nil {
		t.Fatalf("%+v", got)
	}
}

func TestParseMikanTitleS02E07(t *testing.T) {
	got := mikan.ParseMikanTitle("[LoliHouse] Example Show S02E07 [WebRip 1080p]")
	if got.Title != "Example Show" || got.Season == nil || *got.Season != 2 || got.Episode == nil || *got.Episode != 7 {
		t.Fatalf("%+v", got)
	}
}

func TestParseMikanTitleJi(t *testing.T) {
	got := mikan.ParseMikanTitle("[字幕组] 示例番 第07集 [1080P]")
	if got.Title != "示例番" || got.Season != nil || got.Episode == nil || *got.Episode != 7 {
		t.Fatalf("%+v", got)
	}
}

func TestParseMikanTitleCollectionHasNoEpisode(t *testing.T) {
	raw := "[喵萌奶茶屋&LoliHouse] 葬送的芙莉莲 / Sousou no Frieren [01-28 修正合集][WebRip 1080p HEVC-10bit AAC][简繁日内封字幕][Fin]"
	got := mikan.ParseMikanTitle(raw)
	if got.Title != "葬送的芙莉莲" || got.Episode != nil {
		t.Fatalf("%+v", got)
	}
}
