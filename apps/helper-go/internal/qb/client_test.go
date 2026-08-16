package qb_test

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/qb"
)

const (
	hash        = "a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c"
	torrentURL  = "https://mikan.example/Download/20240322/" + hash + ".torrent"
	torrentBlob = "d8:announce16:http://tracker.x4:infod4:name4:fake6:lengthi1eee"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func clientWith(addBody string, torrents string, inspect func(*http.Request)) *qb.HTTPClient {
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
			if inspect != nil {
				inspect(r)
			}
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

func addReq() qb.AddRequest {
	return qb.AddRequest{
		Torrent:  []byte(torrentBlob),
		URLs:     torrentURL,
		SavePath: "/p",
		Category: "Bangumi",
		Tags:     "t",
		Rename:   "Show - S01E01",
	}
}

func TestExtractTorrentInfohash(t *testing.T) {
	if got := qb.ExtractTorrentInfohash(torrentURL); got != hash {
		t.Fatal(got)
	}
}

func TestAddTorrentSendsFileNotURL(t *testing.T) {
	var body string
	client := clientWith("Ok.", `[{"hash":"`+hash+`","name":"Show - S01E01","progress":0,"state":"downloading","tags":"t"}]`, func(r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		body = string(raw)
	})
	if _, err := client.AddTorrent(addReq()); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(body, `name="urls"`) {
		t.Fatal(body)
	}
	if !strings.Contains(body, `name="torrents"`) || !strings.Contains(body, hash+".torrent") {
		t.Fatal(body)
	}
	if !strings.Contains(body, torrentBlob) {
		t.Fatal(body)
	}
}

func TestAddTorrentEmptyFileFails(t *testing.T) {
	client := clientWith("Ok.", "[]", nil)
	_, err := client.AddTorrent(qb.AddRequest{URLs: torrentURL, SavePath: "/p"})
	if err == nil || !strings.Contains(err.Error(), "empty torrent") {
		t.Fatalf("%v", err)
	}
}

func TestAddTorrentFailsBody(t *testing.T) {
	client := clientWith("Fails.", "[]", nil)
	_, err := client.AddTorrent(addReq())
	if err == nil || !strings.Contains(err.Error(), "qBittorrent add failed") {
		t.Fatalf("%v", err)
	}
}

func TestAddTorrentFailsIgnoresListedHash(t *testing.T) {
	client := clientWith("Fails.\n", `[{"hash":"`+hash+`","name":"unrelated","progress":0,"state":"downloading"}]`, nil)
	_, err := client.AddTorrent(addReq())
	if err == nil || !strings.Contains(err.Error(), "qBittorrent add failed") {
		t.Fatalf("%v", err)
	}
}

func TestAddTorrentOkReturnsListedHash(t *testing.T) {
	client := clientWith("Ok.", `[{"hash":"`+hash+`","name":"Show - S01E01","progress":0,"state":"downloading","tags":"t"}]`, nil)
	got, err := client.AddTorrent(addReq())
	if err != nil || got != hash {
		t.Fatalf("%s %v", got, err)
	}
}

func TestAddTorrentOkWithoutListedTorrentFails(t *testing.T) {
	client := clientWith("Ok.", "[]", nil)
	_, err := client.AddTorrent(addReq())
	if err == nil || !strings.Contains(err.Error(), "torrent is missing") {
		t.Fatalf("%v", err)
	}
}

func TestAddTorrentEmptyBodyFails(t *testing.T) {
	client := clientWith("", "[]", nil)
	_, err := client.AddTorrent(addReq())
	if err == nil || !strings.Contains(err.Error(), "torrent is missing") {
		t.Fatalf("%v", err)
	}
}
