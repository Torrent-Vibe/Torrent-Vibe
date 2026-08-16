package mikan_test

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
)

const base = "https://mikan.example"

func fixture(t *testing.T, name string) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("caller")
	}
	path := filepath.Join(filepath.Dir(file), "..", "..", "..", "..", "packages", "mikan", "fixtures", name)
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

func TestJoinAndTorrentURL(t *testing.T) {
	if got := mikan.JoinMikanURL("https://mikanani.me", "/Home/Bangumi/3141"); got != "https://mikanani.me/Home/Bangumi/3141" {
		t.Fatal(got)
	}
	if got := mikan.BangumiRSSURL("https://mikanani.me", "3141", "583"); got != "https://mikanani.me/RSS/Bangumi?bangumiId=3141&subgroupid=583" {
		t.Fatal(got)
	}
	if got := mikan.TorrentDownloadURL(base, "https://mikanani.me/Download/20240322/a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c.torrent"); got != base+"/Download/20240322/a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c.torrent" {
		t.Fatal(got)
	}
}

func TestParseBangumiRSSFixture(t *testing.T) {
	episodes := mikan.ParseBangumiRSS(fixture(t, "rss.xml"), base)
	if len(episodes) != 2 {
		t.Fatalf("len=%d", len(episodes))
	}
	first := episodes[0]
	if first.EpisodeID != "a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c" ||
		first.Title != "[ANi] Sōsō no Frieren /  葬送的芙莉莲 - 28 [1080P][Baha][WEB-DL][AAC AVC][CHT][MP4]" ||
		first.TorrentURL != base+"/Download/20240322/a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c.torrent" ||
		first.PublishedAt != "2024-03-22T23:31:49.457" ||
		first.SizeBytes != 744908416 {
		t.Fatalf("%+v", first)
	}
	if episodes[1].EpisodeID != "238eeb554bcd07b86335c8f8d402a69c11b15789" || episodes[1].SizeBytes != 653388672 {
		t.Fatalf("%+v", episodes[1])
	}
}
