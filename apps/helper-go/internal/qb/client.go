package qb

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

type HTTPClient struct {
	base   string
	user   string
	pass   string
	client *http.Client
	cookie string
}

func NewClient(baseURL, user, pass string, httpClient *http.Client) *HTTPClient {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &HTTPClient{
		base:   strings.TrimRight(baseURL, "/"),
		user:   user,
		pass:   pass,
		client: httpClient,
	}
}

func (c *HTTPClient) login() error {
	form := url.Values{"username": {c.user}, "password": {c.pass}}
	req, err := http.NewRequest(http.MethodPost, c.base+"/api/v2/auth/login", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("content-type", "application/x-www-form-urlencoded")
	res, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	sid := sidFromCookies(res)
	if res.StatusCode >= 400 || sid == "" {
		return errors.New("qBittorrent login failed")
	}
	c.cookie = "SID=" + sid
	return nil
}

func sidFromCookies(res *http.Response) string {
	for _, cookie := range res.Cookies() {
		if strings.EqualFold(cookie.Name, "SID") && cookie.Value != "" {
			return cookie.Value
		}
	}
	return ""
}

func (c *HTTPClient) request(method, path string, body io.Reader, contentType string, retry bool) (*http.Response, error) {
	if c.cookie == "" {
		if err := c.login(); err != nil {
			return nil, err
		}
	}
	req, err := http.NewRequest(method, c.base+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("cookie", c.cookie)
	if contentType != "" {
		req.Header.Set("content-type", contentType)
	}
	res, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	if res.StatusCode == http.StatusForbidden && retry {
		res.Body.Close()
		c.cookie = ""
		return c.request(method, path, body, contentType, false)
	}
	return res, nil
}

func (c *HTTPClient) ListTorrents() ([]Torrent, error) {
	res, err := c.request(http.MethodGet, "/api/v2/torrents/info", nil, "", true)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("qBittorrent list failed: %d", res.StatusCode)
	}
	var payload []struct {
		Hash     string  `json:"hash"`
		Name     string  `json:"name"`
		Progress float64 `json:"progress"`
		State    string  `json:"state"`
		Category string  `json:"category"`
		Tags     string  `json:"tags"`
		SavePath string  `json:"save_path"`
	}
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return nil, err
	}
	out := make([]Torrent, 0, len(payload))
	for _, item := range payload {
		out = append(out, Torrent{
			Hash:     strings.ToLower(item.Hash),
			Name:     item.Name,
			Progress: item.Progress,
			State:    item.State,
			Category: item.Category,
			Tags:     item.Tags,
			SavePath: item.SavePath,
		})
	}
	return out, nil
}

func (c *HTTPClient) AddTorrent(add AddRequest) (string, error) {
	if len(add.Torrent) == 0 {
		return "", errors.New("qBittorrent add failed: empty torrent")
	}
	body, contentType, err := encodeTorrentForm(add)
	if err != nil {
		return "", err
	}
	res, err := c.request(http.MethodPost, "/api/v2/torrents/add", bytes.NewReader(body), contentType, true)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	text := strings.TrimSpace(string(raw))
	if res.StatusCode >= 400 || text == "Fails." {
		if res.StatusCode >= 400 {
			return "", fmt.Errorf("qBittorrent add failed: %d", res.StatusCode)
		}
		return "", fmt.Errorf("qBittorrent add failed: %s", orUnknown(text))
	}
	torrents, err := c.ListTorrents()
	if err != nil {
		return "", err
	}
	fromURL := ExtractTorrentInfohash(add.URLs)
	if fromURL != "" {
		for _, item := range torrents {
			if item.Hash == fromURL {
				return fromURL, nil
			}
		}
	}
	for _, item := range torrents {
		if item.Name == add.Rename && strings.Contains(item.Tags, add.Tags) {
			return item.Hash, nil
		}
	}
	return "", errors.New("qBittorrent add succeeded but torrent is missing")
}

func (c *HTTPClient) ListFiles(hash string) ([]File, error) {
	res, err := c.request(http.MethodGet, "/api/v2/torrents/files?hash="+url.QueryEscape(hash), nil, "", true)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("qBittorrent files failed: %d", res.StatusCode)
	}
	var payload []struct {
		Name string `json:"name"`
		Size int64  `json:"size"`
	}
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return nil, err
	}
	out := make([]File, 0, len(payload))
	for _, item := range payload {
		out = append(out, File{Name: item.Name, Size: item.Size})
	}
	return out, nil
}

func (c *HTTPClient) RenameFile(hash, oldPath, newPath string) error {
	form := url.Values{"hash": {hash}, "oldPath": {oldPath}, "newPath": {newPath}}
	res, err := c.request(http.MethodPost, "/api/v2/torrents/renameFile", strings.NewReader(form.Encode()), "application/x-www-form-urlencoded", true)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return fmt.Errorf("qBittorrent rename failed: %d", res.StatusCode)
	}
	return nil
}

func (c *HTTPClient) DeleteTorrents(hashes []string, deleteFiles bool) error {
	lower := make([]string, 0, len(hashes))
	for _, hash := range hashes {
		if hash != "" {
			lower = append(lower, strings.ToLower(hash))
		}
	}
	if len(lower) == 0 {
		return nil
	}
	form := url.Values{
		"hashes":      {strings.Join(lower, "|")},
		"deleteFiles": {strconv.FormatBool(deleteFiles)},
	}
	res, err := c.request(http.MethodPost, "/api/v2/torrents/delete", strings.NewReader(form.Encode()), "application/x-www-form-urlencoded", true)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return fmt.Errorf("qBittorrent delete failed: %d", res.StatusCode)
	}
	return nil
}

func encodeTorrentForm(add AddRequest) ([]byte, string, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	file, err := writer.CreateFormFile("torrents", torrentFilename(add.URLs))
	if err != nil {
		return nil, "", err
	}
	if _, err := file.Write(add.Torrent); err != nil {
		return nil, "", err
	}
	fields := [][2]string{
		{"savepath", add.SavePath},
		{"category", add.Category},
		{"tags", add.Tags},
		{"rename", add.Rename},
		{"autoTMM", "false"},
	}
	for _, field := range fields {
		if err := writer.WriteField(field[0], field[1]); err != nil {
			return nil, "", err
		}
	}
	if err := writer.Close(); err != nil {
		return nil, "", err
	}
	return body.Bytes(), writer.FormDataContentType(), nil
}

func torrentFilename(rawURL string) string {
	hash := ExtractTorrentInfohash(rawURL)
	if hash == "" {
		return "file.torrent"
	}
	return hash + ".torrent"
}

func orUnknown(text string) string {
	if text == "" {
		return "unknown"
	}
	return text
}
