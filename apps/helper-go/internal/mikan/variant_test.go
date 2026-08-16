package mikan_test

import (
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
)

func TestClassifyLanguage(t *testing.T) {
	cases := []struct {
		title string
		want  mikan.Language
	}{
		{"【豌豆字幕组】药屋少女的呢喃[48][简体][1080P]", mikan.LangSC},
		{"【豌豆字幕组】药屋少女的呢喃[48][繁体][1080P]", mikan.LangTC},
		{"[北宇治字幕组] 药屋少女的呢喃 [48][简日内嵌]", mikan.LangSC},
		{"[北宇治字幕组] 药屋少女的呢喃 [48][繁日内嵌]", mikan.LangTC},
		{"[北宇治字幕组] 药屋少女的呢喃 [48][简繁日内封]", mikan.LangInternal},
		{"[漫猫字幕组] [GB&JP][简日双语][48]", mikan.LangSC},
		{"[漫猫字幕组] [BIG5&JP][繁日双语][48]", mikan.LangTC},
		{"[Skymoon-Raws] Show [CHT&CHS]", mikan.LangInternal},
		{"[组] 药屋少女的呢喃 [48][繁简外挂]", mikan.LangInternal},
		{"[沸羊羊字幕组] 转生之后的我变成了龙蛋 [10][中日双语]", mikan.LangSC},
		{"[组] Show [10][日英双语]", mikan.LangUnset},
		{"[组] Show [10][无字幕]", mikan.LangUnset},
		{"[Skymoon-Raws] Show - 10 [CHT]", mikan.LangTC},
		{"[黒ネズミたち] Show - 10 [1080p]", mikan.LangUnset},
		{"[ANi] 葬送的芙莉莲 - 28 [1080P]", mikan.LangUnset},
		{"Show [简繁日]", mikan.LangUnset},
		{"[RAW] Show - 10 [1080P]", mikan.LangUnset},
	}
	for _, tc := range cases {
		if got := mikan.ClassifyLanguage(tc.title); got != tc.want {
			t.Fatalf("%q: got %q want %q", tc.title, got, tc.want)
		}
	}
}

func TestClassifyResolution(t *testing.T) {
	cases := []struct {
		title string
		rung  int
		ok    bool
	}{
		{"[48][简体][1080P]", 1080, true},
		{"Show 1920x1080", 1080, true},
		{"Show 3840x2160", 2160, true},
		{"Show 4K HDR", 2160, true},
		{"Show 8K", 4320, true},
		{"Show 1280x720", 720, true},
		{"Show 990", 0, false},
		{"Show 480p", 0, false},
		{"[ANi] 葬送的芙莉莲 - 28", 0, false},
		{"WebRip 1080p HEVC 1920x1080", 1080, true},
	}
	for _, tc := range cases {
		got, ok := mikan.ClassifyResolution(tc.title)
		if ok != tc.ok || got != tc.rung {
			t.Fatalf("%q: got %d %v want %d %v", tc.title, got, ok, tc.rung, tc.ok)
		}
	}
}

func TestPickVariant(t *testing.T) {
	prefer := mikan.ParseVariantPrefer("")
	sc := mikan.VariantItem{Index: 0, Language: mikan.LangSC, Resolution: 1080}
	tc := mikan.VariantItem{Index: 1, Language: mikan.LangTC, Resolution: 1080}
	winner, losers := mikan.PickVariant([]mikan.VariantItem{sc, tc}, prefer)
	if winner.Index != 0 || len(losers) != 1 || losers[0].Index != 1 || losers[0].Reason != mikan.SkipReasonLanguage {
		t.Fatalf("sc vs tc: %+v %+v", winner, losers)
	}

	internal := mikan.VariantItem{Index: 0, Language: mikan.LangInternal, Resolution: 1080}
	scEmb := mikan.VariantItem{Index: 1, Language: mikan.LangSC, Resolution: 1080}
	tcEmb := mikan.VariantItem{Index: 2, Language: mikan.LangTC, Resolution: 1080}
	winner, losers = mikan.PickVariant([]mikan.VariantItem{internal, scEmb, tcEmb}, prefer)
	if winner.Index != 0 || len(losers) != 2 {
		t.Fatalf("internal: %+v %+v", winner, losers)
	}

	low := mikan.VariantItem{Index: 0, Language: mikan.LangSC, Resolution: 720}
	high := mikan.VariantItem{Index: 1, Language: mikan.LangSC, Resolution: 1080}
	winner, losers = mikan.PickVariant([]mikan.VariantItem{low, high}, prefer)
	if winner.Index != 1 || losers[0].Reason != mikan.SkipReasonResolution {
		t.Fatalf("res: %+v %+v", winner, losers)
	}

	sc720 := mikan.VariantItem{Index: 0, Language: mikan.LangSC, Resolution: 720}
	tc1080 := mikan.VariantItem{Index: 1, Language: mikan.LangTC, Resolution: 1080}
	winner, losers = mikan.PickVariant([]mikan.VariantItem{sc720, tc1080}, prefer)
	if winner.Index != 1 || losers[0].Reason != mikan.SkipReasonResolution {
		t.Fatalf("res first: %+v %+v", winner, losers)
	}

	scBare := mikan.VariantItem{Index: 0, Language: mikan.LangSC, Resolution: 0}
	tcRes := mikan.VariantItem{Index: 1, Language: mikan.LangTC, Resolution: 1080}
	winner, losers = mikan.PickVariant([]mikan.VariantItem{scBare, tcRes}, prefer)
	if winner.Index != 0 || losers[0].Reason != mikan.SkipReasonLanguage {
		t.Fatalf("unknown res is not zero: %+v %+v", winner, losers)
	}
}

func TestParseVariantPrefer(t *testing.T) {
	if !mikan.ValidVariantPrefer("") || !mikan.ValidVariantPrefer("tc,sc,internal") {
		t.Fatal("valid rejected")
	}
	if mikan.ValidVariantPrefer("sc") || mikan.ValidVariantPrefer("internal,sc,sc") {
		t.Fatal("invalid accepted")
	}
	if got := mikan.EffectiveVariantPrefer(""); got != mikan.DefaultVariantPrefer {
		t.Fatal(got)
	}
	if got := mikan.EffectiveVariantPrefer("nope"); got != mikan.DefaultVariantPrefer {
		t.Fatal(got)
	}
	list := mikan.ParseVariantPrefer("tc, internal, sc")
	if list[0] != mikan.LangTC || list[1] != mikan.LangInternal || list[2] != mikan.LangSC {
		t.Fatalf("%+v", list)
	}
}
