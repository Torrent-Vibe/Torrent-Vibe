package qb_test

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/qb"
)

const (
	hash       = "a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c"
	torrentURL = "https://mikan.example/Download/20240322/" + hash + ".torrent"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func clientWith(addBody string, torrents string) *qb.HTTPClient {
	transport := roundTripFunc(func(r *http.Request) (*http.Response, error) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/api/v2/auth/login"):
			return &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(strings.NewReader("Ok.")),
				Header:     http.Header{"Set-Cookie": []string{"SID=test-sid; Path=/"}},
				Request:    r,
			}, nil
		case strings.Contains(r.URL.Path, "/api/v2/torrents/add"):
			return &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(strings.NewReader(addBody)),
				Header:     make(http.Header),
				Request:    r,
			}, nil
		case strings.Contains(r.URL.Path, "/api/v2/torrents/info"):
			return &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(strings.NewReader(torrents)),
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Request:    r,
			}, nil
		default:
			return nil, io.EOF
		}
	})
	return qb.NewClient("http://127.0.0.1:8080", "admin", "pass", &http.Client{Transport: transport})
}

func TestExtractTorrentInfohash(t *testing.T) {
	if got := qb.ExtractTorrentInfohash(torrentURL); got != hash {
		t.Fatal(got)
	}
}

func TestAddTorrentFailsBody(t *testing.T) {
	client := clientWith("Fails.", "[]")
	_, err := client.AddTorrent(qb.AddRequest{
		URLs: torrentURL, SavePath: "/library/Show/Season 01",
		Category: "Bangumi", Tags: "tv-mikan:sub-1", Rename: "Show - S01E01",
	})
	if err == nil || !strings.Contains(err.Error(), "qBittorrent add failed") {
		t.Fatalf("%v", err)
	}
}

func TestAddTorrentFailsIgnoresListedHash(t *testing.T) {
	client := clientWith("Fails.\n", `[{"hash":"`+hash+`","name":"unrelated","progress":0,"state":"downloading"}]`)
	_, err := client.AddTorrent(qb.AddRequest{
		URLs: torrentURL, SavePath: "/p", Category: "Bangumi", Tags: "t", Rename: "n",
	})
	if err == nil || !strings.Contains(err.Error(), "qBittorrent add failed") {
		t.Fatalf("%v", err)
	}
}

func TestAddTorrentOkReturnsHash(t *testing.T) {
	client := clientWith("Ok.", `[{"hash":"`+hash+`","name":"Show - S01E01","progress":0,"state":"downloading"}]`)
	got, err := client.AddTorrent(qb.AddRequest{
		URLs: torrentURL, SavePath: "/p", Category: "Bangumi", Tags: "t", Rename: "Show - S01E01",
	})
	if err != nil || got != hash {
		t.Fatalf("%s %v", got, err)
	}
}

func TestAddTorrentEmptyBodyFails(t *testing.T) {
	client := clientWith("", "[]")
	_, err := client.AddTorrent(qb.AddRequest{
		URLs: torrentURL, SavePath: "/p", Category: "Bangumi", Tags: "t", Rename: "n",
	})
	if err == nil || !strings.Contains(err.Error(), "qBittorrent add failed") {
		t.Fatalf("%v", err)
	}
}
