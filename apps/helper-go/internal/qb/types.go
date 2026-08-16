package qb

import (
	"regexp"
	"strings"
)

type Torrent struct {
	Hash     string
	Name     string
	State    string
	Category string
	Tags     string
	Progress float64
}

type File struct {
	Name string
	Size int64
}

type AddRequest struct {
	Torrent  []byte
	URLs     string
	SavePath string
	Category string
	Tags     string
	Rename   string
}

type Client interface {
	ListTorrents() ([]Torrent, error)
	AddTorrent(AddRequest) (string, error)
	ListFiles(hash string) ([]File, error)
	RenameFile(hash, oldPath, newPath string) error
}

var infohashRe = regexp.MustCompile(`(?i)([a-f0-9]{40})(?:\.torrent)?(?:[?#]|$)`)

func ExtractTorrentInfohash(rawURL string) string {
	match := infohashRe.FindStringSubmatch(rawURL)
	if match == nil {
		return ""
	}
	return strings.ToLower(match[1])
}
