package loop_test

import (
	"errors"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/events"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/loop"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/redact"
)

func TestRSSFetchFailureEmitsWarnEvent(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	rec := events.New(t.TempDir(), redact.Sanitizer(redact.NewRegistry()))
	_ = loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library", FetchTorrent: torrentOK, Events: rec,
		FetchRSS: func(string) (loop.RSSResult, error) {
			return loop.RSSResult{StatusCode: 503}, errors.New("mikan unreachable")
		},
	})
	got, _ := rec.Query(events.Query{Kind: "rss.fetch"})
	if len(got) != 1 {
		t.Fatalf("want exactly one rss.fetch event, got %+v", got)
	}
	if got[0].Level != "warn" {
		t.Fatalf("level = %q, want warn", got[0].Level)
	}
	if got[0].Fields["httpStatus"] != 503 {
		t.Fatalf("httpStatus = %+v", got[0].Fields["httpStatus"])
	}
	if got[0].Fields["error"] != "mikan unreachable" {
		t.Fatalf("error = %+v", got[0].Fields["error"])
	}
}

func TestTickEmitsStartAndDoneWithAddedCount(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	rec := events.New(t.TempDir(), redact.Sanitizer(redact.NewRegistry()))
	_ = loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library", FetchTorrent: torrentOK, Events: rec,
		FetchRSS: func(string) (loop.RSSResult, error) {
			return loop.RSSResult{Body: rssFeed(
				rssItem("【豌豆字幕组】药屋少女的呢喃[48][简体][1080P]", hashSC),
				rssItem("【豌豆字幕组】药屋少女的呢喃[48][繁体][1080P]", hashTC),
			)}, nil
		},
	})
	starts, _ := rec.Query(events.Query{Kind: "tick.start"})
	if len(starts) != 1 {
		t.Fatalf("want 1 tick.start, got %d", len(starts))
	}
	dones, _ := rec.Query(events.Query{Kind: "tick.done"})
	if len(dones) != 1 {
		t.Fatalf("want 1 tick.done, got %d", len(dones))
	}
	if len(qbFake.added) != 1 {
		t.Fatalf("test setup: want 1 qb add (one winner, one skipped loser), got %d", len(qbFake.added))
	}
	if dones[0].Fields["addedCount"] != 1 {
		t.Fatalf("addedCount = %+v, want 1 (only episodes that reached qBittorrent, not the skipped loser)", dones[0].Fields["addedCount"])
	}
}

func TestVariantPickLoserEmitsEpisodeSkip(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	rec := events.New(t.TempDir(), redact.Sanitizer(redact.NewRegistry()))
	_ = loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library", FetchTorrent: torrentOK, Events: rec,
		FetchRSS: func(string) (loop.RSSResult, error) {
			return loop.RSSResult{Body: rssFeed(
				rssItem("【豌豆字幕组】药屋少女的呢喃[48][简体][1080P]", hashSC),
				rssItem("【豌豆字幕组】药屋少女的呢喃[48][繁体][1080P]", hashTC),
			)}, nil
		},
	})
	got, _ := rec.Query(events.Query{Kind: "episode.skip"})
	if len(got) != 1 {
		t.Fatalf("want 1 episode.skip, got %+v", got)
	}
	if got[0].Fields["reason"] != mikan.SkipReasonLanguage {
		t.Fatalf("reason = %+v", got[0].Fields["reason"])
	}
	if got[0].Fields["rival"] != "【豌豆字幕组】药屋少女的呢喃[48][简体][1080P]" {
		t.Fatalf("rival = %+v", got[0].Fields["rival"])
	}
}

func TestCollectionEmitsEpisodeManual(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	rec := events.New(t.TempDir(), redact.Sanitizer(redact.NewRegistry()))
	_ = loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library", FetchTorrent: torrentOK, Events: rec,
		FetchRSS: func(string) (loop.RSSResult, error) {
			return loop.RSSResult{Body: rssXML(packTitle, hashPack)}, nil
		},
	})
	got, _ := rec.Query(events.Query{Kind: "episode.manual"})
	if len(got) != 1 {
		t.Fatalf("want 1 episode.manual, got %+v", got)
	}
	if got[0].Fields["reason"] != "collection" {
		t.Fatalf("reason = %+v", got[0].Fields["reason"])
	}
}

func TestQbAddFailureEmitsErrorEvent(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	qbFake.addErr = errors.New("qBittorrent add failed")
	rec := events.New(t.TempDir(), redact.Sanitizer(redact.NewRegistry()))
	_ = loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library", FetchTorrent: torrentOK, Events: rec,
		FetchRSS: func(string) (loop.RSSResult, error) {
			return loop.RSSResult{Body: rssXML("[ANi] 葬送的芙莉莲 - 28 [1080P]", hash28)}, nil
		},
	})
	got, _ := rec.Query(events.Query{Kind: "qb.add"})
	if len(got) != 1 {
		t.Fatalf("want 1 qb.add, got %+v", got)
	}
	if got[0].Level != "error" {
		t.Fatalf("level = %q, want error", got[0].Level)
	}
	if got[0].Fields["error"] != "qBittorrent add failed" {
		t.Fatalf("error = %+v", got[0].Fields["error"])
	}
}
