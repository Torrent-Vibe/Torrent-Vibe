package mikan_test

import (
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
)

func TestIdentifyNigeSeasonTwo(t *testing.T) {
	id := mikan.Identify(
		"擅长逃跑的殿下 第二季",
		"[ANi] Nige Jouzu no Wakagimi S02 /  擅长逃跑的殿下 第二季 - 17 [1080P][Baha][WEB-DL][AAC AVC][CHT][MP4]",
	)
	if id.Series != "擅长逃跑的殿下" || id.Season == nil || *id.Season != 2 || id.Episode == nil || *id.Episode != 17 || id.Kind != mikan.KindEpisode || id.SeasonAmbiguous {
		t.Fatalf("%+v", id)
	}
}

func TestIdentifySeasonFromSubscriptionOnly(t *testing.T) {
	id := mikan.Identify("擅长逃跑的殿下 第二季", "[ANi] 擅长逃跑的殿下 - 17 [1080P]")
	if id.Series != "擅长逃跑的殿下" || id.Season == nil || *id.Season != 2 || id.Episode == nil || *id.Episode != 17 {
		t.Fatalf("%+v", id)
	}
}

func TestIdentifyAmbiguousPart(t *testing.T) {
	id := mikan.Identify("无职转生Ⅱ 第2部分", "[字幕组] 无职转生 - 05 [1080P]")
	if id.Series != "无职转生" || id.Season != nil || !id.SeasonAmbiguous || id.Hint != mikan.HintPart || id.HintN != 2 {
		t.Fatalf("%+v", id)
	}
}

func TestIdentifyClearBeatsAmbiguous(t *testing.T) {
	id := mikan.Identify("示例番 第二季 第2部分", "[组] 示例番 - 01 [1080P]")
	if id.Season == nil || *id.Season != 2 || id.SeasonAmbiguous {
		t.Fatalf("%+v", id)
	}
}

func TestIdentifySpecials(t *testing.T) {
	cases := []string{
		"[组] 示例番 [SP][01][1080P]",
		"[组] 示例番 [OVA] 01 [1080P]",
		"[组] 示例番 [总集篇][01]",
	}
	for _, title := range cases {
		id := mikan.Identify("示例番", title)
		if id.Kind != mikan.KindSpecial || id.Season == nil || *id.Season != 0 {
			t.Fatalf("%s %+v", title, id)
		}
	}
}

func TestIdentifyCollection(t *testing.T) {
	id := mikan.Identify("葬送的芙莉莲", "[喵萌奶茶屋&LoliHouse] 葬送的芙莉莲 / Sousou no Frieren [01-28 修正合集][WebRip 1080p HEVC-10bit AAC][简繁日内封字幕][Fin]")
	if id.Kind != mikan.KindCollection || id.Episode != nil {
		t.Fatalf("%+v", id)
	}
}

func TestIdentifySxxEyy(t *testing.T) {
	id := mikan.Identify("Example Show", "[LoliHouse] Example Show S02E07 [WebRip 1080p]")
	if id.Season == nil || *id.Season != 2 || id.Episode == nil || *id.Episode != 7 {
		t.Fatalf("%+v", id)
	}
}

func TestIdentifySeasonWords(t *testing.T) {
	cases := []struct {
		sub  string
		want int
	}{
		{"示例番 第3期", 3},
		{"示例番 3rd Season", 3},
		{"示例番 第十三季", 13},
	}
	for _, tc := range cases {
		id := mikan.Identify(tc.sub, "[组] 示例番 - 01 [1080P]")
		if id.Season == nil || *id.Season != tc.want {
			t.Fatalf("%s %+v", tc.sub, id)
		}
	}
}

func TestIdentifyOVAStudioNotSpecial(t *testing.T) {
	id := mikan.Identify("示例番", "[OVA工作室] 示例番 - 01 [1080P]")
	if id.Kind != mikan.KindEpisode {
		t.Fatalf("%+v", id)
	}
}

func TestIdentifyEmptySubscriptionUsesTorrent(t *testing.T) {
	id := mikan.Identify("", "[ANi] Nige Jouzu no Wakagimi S02 /  擅长逃跑的殿下 第二季 - 17 [1080P]")
	if id.Series == "" || id.Season == nil || *id.Season != 2 || id.Episode == nil || *id.Episode != 17 {
		t.Fatalf("%+v", id)
	}
}
