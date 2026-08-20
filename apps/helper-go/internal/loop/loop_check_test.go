package loop_test

import (
	"errors"
	"testing"
	"time"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/loop"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
)

func TestRunTickReportsSuccessfulCheck(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	before := time.Now()
	var calls int
	var gotKey string
	var gotAt time.Time
	var gotErr error
	_ = loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library", FetchTorrent: torrentOK,
		FetchRSS: func(string) (loop.RSSResult, error) {
			return loop.RSSResult{Body: rssFeed()}, nil
		},
		OnReplicaChecked: func(key string, at time.Time, err error) {
			calls++
			gotKey, gotAt, gotErr = key, at, err
		},
	})
	if calls != 1 {
		t.Fatalf("calls = %d, want 1", calls)
	}
	if gotKey != mapKey {
		t.Fatalf("key = %q, want %q", gotKey, mapKey)
	}
	if gotAt.Before(before) {
		t.Fatalf("at = %v, want >= %v", gotAt, before)
	}
	if gotErr != nil {
		t.Fatalf("err = %v, want nil", gotErr)
	}
}

func TestRunTickReportsFailedCheck(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	fetchErr := errors.New("mikan unreachable")
	var calls int
	var gotErr error
	_ = loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library", FetchTorrent: torrentOK,
		FetchRSS: func(string) (loop.RSSResult, error) {
			return loop.RSSResult{StatusCode: 503}, fetchErr
		},
		OnReplicaChecked: func(key string, at time.Time, err error) {
			calls++
			gotErr = err
		},
	})
	if calls != 1 {
		t.Fatalf("calls = %d, want 1", calls)
	}
	if gotErr == nil || gotErr.Error() != "mikan unreachable" {
		t.Fatalf("err = %v, want %q", gotErr, fetchErr.Error())
	}
}

func TestRunTickRecordsCheckFailureWhenQBUnreachable(t *testing.T) {
	s := seed(t, []protocol.Replica{replica("", "")}, nil)
	qbFake := newFake()
	qbFake.listErr = errors.New("connection refused")
	var calls int
	var gotKey string
	var gotErr error
	fetchCalled := false
	_ = loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library", FetchTorrent: torrentOK,
		FetchRSS: func(string) (loop.RSSResult, error) {
			fetchCalled = true
			return loop.RSSResult{Body: rssFeed()}, nil
		},
		OnReplicaChecked: func(key string, at time.Time, err error) {
			calls++
			gotKey, gotErr = key, err
		},
	})
	if fetchCalled {
		t.Fatal("FetchRSS should not run when qBittorrent is unreachable")
	}
	if calls != 1 {
		t.Fatalf("calls = %d, want 1", calls)
	}
	if gotKey != mapKey {
		t.Fatalf("key = %q, want %q", gotKey, mapKey)
	}
	if gotErr == nil || gotErr.Error() != "connection refused" {
		t.Fatalf("err = %v, want %q", gotErr, "connection refused")
	}
}

func TestRunTickSkipsOnReplicaCheckedWithoutFetchAttempt(t *testing.T) {
	replicaNoRSS := replica("", "")
	replicaNoRSS.RSSURL = ""
	s := seed(t, []protocol.Replica{replicaNoRSS}, nil)
	qbFake := newFake()
	calls := 0
	_ = loop.Tick(loop.Deps{
		Store: s, QB: qbFake, LibraryRoot: "/library", FetchTorrent: torrentOK,
		FetchRSS: func(string) (loop.RSSResult, error) {
			t.Fatal("FetchRSS should not be called when RSSURL is empty")
			return loop.RSSResult{}, nil
		},
		OnReplicaChecked: func(key string, at time.Time, err error) {
			calls++
		},
	})
	if calls != 0 {
		t.Fatalf("calls = %d, want 0", calls)
	}
}
