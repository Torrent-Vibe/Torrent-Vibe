package rename_test

import (
	"reflect"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/qb"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/rename"
)

func TestSanitizeTitleAndVideo(t *testing.T) {
	if got := rename.SanitizeTitle(`A:B`); got != "A_B" {
		t.Fatal(got)
	}
	if !rename.IsVideo("a.mkv") || !rename.IsSkippedExtra("foo.sample.mkv") {
		t.Fatal("video/extra helpers")
	}
}

func TestFormatEpisodeName(t *testing.T) {
	if got := rename.FormatEpisodeName("葬送的芙莉莲", 1, 28); got != "葬送的芙莉莲 - S01E28" {
		t.Fatal(got)
	}
	if got := rename.FormatEpisodeName("Example Show", 2, 7); got != "Example Show - S02E07" {
		t.Fatal(got)
	}
}

func TestFormatSavePath(t *testing.T) {
	if got := rename.FormatSavePath("/library", "葬送的芙莉莲", 1); got != "/library/葬送的芙莉莲/Season 01" {
		t.Fatal(got)
	}
	if got := rename.FormatSavePath("/library", "Example Show", 2); got != "/library/Example Show/Season 02" {
		t.Fatal(got)
	}
}

func TestPlanRenamesVideoAndSub(t *testing.T) {
	got := rename.PlanEpisodeRenames("葬送的芙莉莲 - S01E28", []qb.File{
		{Name: "[ANi] 葬送的芙莉莲 - 28 [1080P].mp4", Size: 700_000_000},
		{Name: "[ANi] 葬送的芙莉莲 - 28 [1080P].cht.ass", Size: 40_000},
	})
	want := []rename.Plan{
		{From: "[ANi] 葬送的芙莉莲 - 28 [1080P].mp4", To: "葬送的芙莉莲 - S01E28.mp4"},
		{From: "[ANi] 葬送的芙莉莲 - 28 [1080P].cht.ass", To: "葬送的芙莉莲 - S01E28.cht.ass"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("%+v", got)
	}
}

func TestPlanRenamesSkipsExtras(t *testing.T) {
	got := rename.PlanEpisodeRenames("Show - S01E01", []qb.File{
		{Name: "Show/Show - 01.mkv", Size: 1_000_000_000},
		{Name: "Show/Sample/Show - 01 Sample.mkv", Size: 20_000_000},
		{Name: "Show/NCOP/Show NCOP.mkv", Size: 50_000_000},
		{Name: "Show/NCED/Show NCED.mkv", Size: 50_000_000},
		{Name: "Show/Show - 01.ass", Size: 30_000},
	})
	want := []rename.Plan{
		{From: "Show/Show - 01.mkv", To: "Show/Show - S01E01.mkv"},
		{From: "Show/Show - 01.ass", To: "Show/Show - S01E01.ass"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("%+v", got)
	}
}

func TestPlanRenamesAlreadyMatch(t *testing.T) {
	got := rename.PlanEpisodeRenames("Show - S01E01", []qb.File{{Name: "Show - S01E01.mkv", Size: 1}})
	if len(got) != 0 {
		t.Fatalf("%+v", got)
	}
}

func TestPlanRenamesLargestVideo(t *testing.T) {
	got := rename.PlanEpisodeRenames("Show - S01E01", []qb.File{
		{Name: "Show/Show - 01.mkv", Size: 2_000_000_000},
		{Name: "Show/Show - 01 extra commentary.mp4", Size: 80_000_000},
		{Name: "Show/Show - 01.srt", Size: 20_000},
	})
	want := []rename.Plan{
		{From: "Show/Show - 01.mkv", To: "Show/Show - S01E01.mkv"},
		{From: "Show/Show - 01.srt", To: "Show/Show - S01E01.srt"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("%+v", got)
	}
}
