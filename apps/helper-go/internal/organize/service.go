package organize

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/analyze"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/qb"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/tmdb"
)

const (
	StatusReady       = store.OrganizeStatusReady
	StatusOK          = store.OrganizeStatusOK
	StatusAlready     = store.OrganizeStatusAlready
	StatusSkipped     = store.OrganizeStatusSkipped
	StatusNeedsManual = store.OrganizeStatusNeedsManual
	StatusDeferred    = store.OrganizeStatusDeferred

	ReasonMissingLibrary  = "missing-library-root"
	ReasonMissingTmdbKey  = "missing-tmdb-key"
	ReasonMissingSavePath = "missing-save-path"
	ReasonTorrentMissing  = "torrent-not-found"
	ReasonNoVideo         = "no-video"
	ReasonParseFailed     = "parse-failed"
	ReasonUnsupportedKind = "unsupported-kind"
	ReasonCollection      = "collection"
	ReasonMissingEpisode  = "missing-episode"
	ReasonNoUniqueTmdb    = "no-unique-tmdb"
	ReasonDestConflict    = "dest-conflict"
	ReasonOutsideLibrary  = "outside-library"
	ReasonApplyFailed     = "apply-failed"
)

type Result struct {
	Hash           string `json:"hash"`
	Status         string `json:"status"`
	LibraryRelPath string `json:"libraryRelPath,omitempty"`
	TmdbID         int    `json:"tmdbId,omitempty"`
	Reason         string `json:"reason,omitempty"`
	Dest           string `json:"dest,omitempty"`
	At             string `json:"at,omitempty"`
}

type planned struct {
	Result
	src string
}

type Deps struct {
	QB          qb.Client
	Episodes    *store.Store
	Organized   *store.OrganizedStore
	LibraryRoot string
	Profile     *store.ProfileStore
	Fetch       func(rawURL string) ([]byte, error)
	PostJSON    analyze.PostJSON
	Analyze     func(ctx context.Context, request analyze.Request) (*analyze.Identity, error)
	Now         func() time.Time
	Link        func(oldName, newName string) error
	Copy        func(oldName, newName string) error
}

type Service struct {
	deps Deps
}

func New(deps Deps) *Service {
	if deps.Now == nil {
		deps.Now = func() time.Time { return time.Now().UTC() }
	}
	if deps.Link == nil {
		deps.Link = os.Link
	}
	if deps.Copy == nil {
		deps.Copy = copyFile
	}
	return &Service{deps: deps}
}

func (s *Service) Plan(hash string) Result {
	return s.plan(strings.ToLower(strings.TrimSpace(hash))).Result
}

func (s *Service) Apply(hash string) Result {
	next := s.plan(strings.ToLower(strings.TrimSpace(hash)))
	if next.Status == StatusReady {
		if err := s.place(next.src, next.Dest); err != nil {
			if errors.Is(err, errDestConflict) {
				next.Status = StatusNeedsManual
				next.Reason = ReasonDestConflict
			} else {
				next.Status = StatusNeedsManual
				next.Reason = ReasonApplyFailed
			}
		} else {
			next.Status = StatusOK
			next.Reason = ""
		}
	}
	s.persist(next.Result)
	return next.Result
}

func (s *Service) ScanCompleted(torrents []qb.Torrent) error {
	if s.deps.Organized == nil {
		return nil
	}
	baselined, err := s.deps.Organized.Baselined()
	if err != nil {
		return err
	}
	if !baselined {
		return s.RememberCompleted(torrents)
	}
	for _, torrent := range torrents {
		if !qb.IsComplete(torrent) {
			continue
		}
		hash := strings.ToLower(torrent.Hash)
		if _, ok, err := s.deps.Organized.Get(hash); err != nil {
			return err
		} else if ok {
			continue
		}
		s.Apply(hash)
	}
	return nil
}

func (s *Service) RememberCompleted(torrents []qb.Torrent) error {
	if s.deps.Organized == nil {
		return nil
	}
	at := s.deps.Now().Format(time.RFC3339Nano)
	for _, torrent := range torrents {
		if !qb.IsComplete(torrent) {
			continue
		}
		if _, err := s.deps.Organized.PutIfAbsent(store.OrganizedRecord{
			Hash:   strings.ToLower(torrent.Hash),
			Status: StatusDeferred,
			At:     at,
		}); err != nil {
			return err
		}
	}
	return s.deps.Organized.MarkBaselined()
}

func (s *Service) plan(hash string) planned {
	next := planned{Result: Result{Hash: hash, At: s.deps.Now().Format(time.RFC3339Nano)}}
	if hash == "" {
		return next.manual(ReasonTorrentMissing)
	}
	if s.helperManaged(hash) {
		next.Status = StatusSkipped
		return next
	}
	if strings.TrimSpace(s.deps.LibraryRoot) == "" {
		return next.manual(ReasonMissingLibrary)
	}
	key := strings.TrimSpace(s.tmdbKey())
	if key == "" {
		return next.manual(ReasonMissingTmdbKey)
	}
	torrent, files, ok := s.lookup(hash)
	if !ok {
		return next.manual(ReasonTorrentMissing)
	}
	if strings.Contains(torrent.Tags, "tv-mikan:") {
		next.Status = StatusSkipped
		return next
	}
	videos := videoFiles(files)
	if len(videos) == 0 {
		return next.manual(ReasonNoVideo)
	}
	if distinctEpisodeVideos(videos) {
		return next.manual(ReasonCollection)
	}
	primary := primaryVideo(videos)
	parsed := Parse(torrent.Name, files)
	if parsed.Title == "" {
		return next.manual(ReasonParseFailed)
	}
	switch parsed.Kind {
	case KindMusic, KindOther:
		return next.manual(ReasonUnsupportedKind)
	case KindCollection:
		return next.manual(ReasonCollection)
	case KindTV, KindAnime:
		if parsed.Episode == nil {
			return next.manual(ReasonMissingEpisode)
		}
	}
	client := tmdb.New(key, s.deps.Fetch)
	var (
		match *tmdb.Match
		err   error
	)
	if parsed.Kind == KindMovie {
		match, err = client.SearchUniqueMovie(parsed.Title)
	} else {
		match, err = client.SearchUniqueTV(parsed.Title)
		if err == nil && match != nil && parsed.SeasonAmbiguous && parsed.Season == nil {
			if season := client.PickSeason(match.ID, parsed.Identity); season != nil {
				parsed.Season = season
				parsed.SeasonAmbiguous = false
			}
		}
	}
	if err != nil || match == nil {
		ident, _ := s.identify(torrent.Name, files, parsed)
		if ident != nil && ident.Unsupported() {
			return next.manual(ReasonUnsupportedKind)
		}
		if ident == nil || !ident.Ready() {
			return next.manual(ReasonNoUniqueTmdb)
		}
		parsed = applyIdentity(parsed, ident)
		if (parsed.Kind == KindTV || parsed.Kind == KindAnime) && parsed.Episode == nil {
			return next.manual(ReasonMissingEpisode)
		}
		match = &tmdb.Match{ID: ident.TMDBID, Title: ident.Title, Year: ident.Year}
	}
	title := firstNonEmpty(match.Title, parsed.Title)
	year := match.Year
	if year == 0 {
		year = parsed.Year
	}
	rel := libraryRelPath(parsed, title, year, extOf(primary.Name))
	dest := filepath.Join(s.deps.LibraryRoot, filepath.FromSlash(rel))
	if !underRoot(s.deps.LibraryRoot, dest) {
		return next.manual(ReasonOutsideLibrary)
	}
	if strings.TrimSpace(torrent.SavePath) == "" {
		return next.manual(ReasonMissingSavePath)
	}
	src := joinSource(torrent.SavePath, primary.Name)
	next.LibraryRelPath = rel
	next.TmdbID = match.ID
	next.Dest = dest
	next.src = src
	if info, err := os.Lstat(dest); err == nil {
		srcInfo, srcErr := os.Stat(src)
		if srcErr == nil && os.SameFile(srcInfo, info) {
			next.Status = StatusAlready
			return next
		}
		return next.manual(ReasonDestConflict)
	}
	next.Status = StatusReady
	return next
}

func (s *Service) place(src, dest string) error {
	if !underRoot(s.deps.LibraryRoot, dest) {
		return errOutside
	}
	if src == "" {
		return errors.New("missing source")
	}
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	if info, err := os.Lstat(dest); err == nil {
		srcInfo, srcErr := os.Stat(src)
		if srcErr == nil && os.SameFile(srcInfo, info) {
			return nil
		}
		return errDestConflict
	}
	if err := s.deps.Link(src, dest); err == nil {
		return nil
	} else if !isEXDEV(err) {
		return err
	}
	return s.deps.Copy(src, dest)
}

func (s *Service) persist(result Result) {
	if s.deps.Organized == nil || result.Hash == "" || result.Status == StatusReady {
		return
	}
	_ = s.deps.Organized.Put(store.OrganizedRecord{
		Hash:           result.Hash,
		Status:         result.Status,
		LibraryRelPath: result.LibraryRelPath,
		TmdbID:         result.TmdbID,
		Reason:         result.Reason,
		At:             result.At,
	})
}

func (s *Service) helperManaged(hash string) bool {
	if s.deps.Episodes == nil {
		return false
	}
	episodes, err := s.deps.Episodes.LoadEpisodes()
	if err != nil {
		return false
	}
	for _, list := range episodes {
		for _, episode := range list {
			if episode.Infohash != "" && strings.EqualFold(episode.Infohash, hash) {
				return true
			}
		}
	}
	return false
}

func (s *Service) tmdbKey() string {
	if s.deps.Profile == nil {
		return ""
	}
	return s.deps.Profile.Value("metadata.tmdb.apiKey")
}

func (s *Service) identify(name string, files []qb.File, parsed Parsed) (*analyze.Identity, error) {
	request := analyze.Request{
		TorrentName: name,
		Files:       fileNames(files),
		ParsedTitle: parsed.Title,
		ParsedYear:  parsed.Year,
		ParsedKind:  string(parsed.Kind),
		Season:      parsed.Season,
		Episode:     parsed.Episode,
	}
	if s.deps.Analyze != nil {
		return s.deps.Analyze(context.Background(), request)
	}
	provider := analyze.SelectProvider(s.deps.Profile)
	if provider == nil || s.deps.PostJSON == nil {
		return nil, nil
	}
	return analyze.New(*provider, tmdb.New(s.tmdbKey(), s.deps.Fetch), s.deps.PostJSON).Identify(context.Background(), request)
}

func applyIdentity(parsed Parsed, ident *analyze.Identity) Parsed {
	if ident == nil {
		return parsed
	}
	if strings.TrimSpace(ident.Title) != "" {
		parsed.Title = ident.Title
	}
	if ident.Year > 0 {
		parsed.Year = ident.Year
	}
	if ident.Season != nil {
		parsed.Season = ident.Season
		parsed.SeasonAmbiguous = false
	}
	if ident.Episode != nil {
		parsed.Episode = ident.Episode
	}
	switch ident.MediaType {
	case "movie":
		parsed.Kind = KindMovie
	case "tv":
		parsed.Kind = KindTV
	case "anime":
		parsed.Kind = KindAnime
	}
	return parsed
}

func fileNames(files []qb.File) []string {
	out := make([]string, 0, len(files))
	for _, file := range files {
		out = append(out, file.Name)
	}
	return out
}

func (s *Service) lookup(hash string) (qb.Torrent, []qb.File, bool) {
	if s.deps.QB == nil {
		return qb.Torrent{}, nil, false
	}
	torrents, err := s.deps.QB.ListTorrents()
	if err != nil {
		return qb.Torrent{}, nil, false
	}
	var found qb.Torrent
	ok := false
	for _, torrent := range torrents {
		if strings.EqualFold(torrent.Hash, hash) {
			found = torrent
			ok = true
			break
		}
	}
	if !ok {
		return qb.Torrent{}, nil, false
	}
	files, err := s.deps.QB.ListFiles(found.Hash)
	if err != nil {
		return found, nil, false
	}
	return found, files, true
}

func (p planned) manual(reason string) planned {
	p.Status = StatusNeedsManual
	p.Reason = reason
	return p
}

func distinctEpisodeVideos(files []qb.File) bool {
	seen := map[string]struct{}{}
	for _, file := range files {
		ident := Parse(filepath.Base(file.Name), []qb.File{file})
		if ident.Episode == nil {
			continue
		}
		key := ident.Title
		if ident.Season != nil {
			key += "/s" + itoa(*ident.Season)
		}
		key += "/e" + itoa(*ident.Episode)
		seen[key] = struct{}{}
	}
	return len(seen) > 1
}

func itoa(n int) string {
	return strconv.Itoa(n)
}

var (
	errDestConflict = errors.New("destination conflict")
	errOutside      = errors.New("outside library")
)

func isEXDEV(err error) bool {
	return errors.Is(err, syscall.EXDEV)
}

func copyFile(src, dest string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dest, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		_ = os.Remove(dest)
		return err
	}
	if err := out.Close(); err != nil {
		_ = os.Remove(dest)
		return err
	}
	return nil
}
