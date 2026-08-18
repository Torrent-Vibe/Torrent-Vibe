package organize

import (
	"path"
	"regexp"
	"strconv"
	"strings"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/qb"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/rename"
)

type Kind string

const (
	KindMovie      Kind = "movie"
	KindTV         Kind = "tv"
	KindAnime      Kind = "anime"
	KindMusic      Kind = "music"
	KindOther      Kind = "other"
	KindCollection Kind = "collection"
)

type Parsed struct {
	Title           string
	Year            int
	Season          *int
	Episode         *int
	Kind            Kind
	SeasonAmbiguous bool
	Identity        mikan.Identity
}

var (
	yearRe        = regexp.MustCompile(`\b((?:19|20)\d{2})\b`)
	releaseToken  = regexp.MustCompile(`(?i)\b(?:\d{3,4}p|4k|uhd|hdr10(?:\+|plus)?|hdr|dovi|dolby.?vision|bluray|blu-ray|bdrip|web-?dl|webrip|web|hdtv|dvdrip|remux|x264|x265|h\.?264|h\.?265|hevc|avc|aac(?:5\.1)?|ac3|dts(?:-hd)?|truehd|atmos|flac|10-?bit|8-?bit|proper|repack|internal|multi(?:audio|subs)?|dual[\s-]?audio)\b`)
	dotName       = regexp.MustCompile(`[._]+`)
	musicExt      = map[string]struct{}{
		".mp3": {}, ".flac": {}, ".m4a": {}, ".wav": {}, ".ogg": {}, ".aac": {}, ".wma": {}, ".alac": {},
	}
	groupPrefix = regexp.MustCompile(`^\s*\[[^\]]+\]`)
	cjkRe       = regexp.MustCompile(`[\x{3400}-\x{9FFF}]`)
	animeEp     = regexp.MustCompile(`(?i)(?:^|[^0-9])-\s*(\d{1,4})(?:\s*[\[(]|$)`)
)

func Parse(torrentName string, files []qb.File) Parsed {
	if onlyMusic(files) {
		return Parsed{Title: torrentName, Kind: KindMusic}
	}
	source := strings.TrimSpace(torrentName)
	if video := primaryVideo(files); video.Name != "" {
		base := stem(video.Name)
		if source == "" {
			source = base
		}
	}
	ident := mikan.Identify("", source)
	if ident.Kind == mikan.KindCollection {
		return Parsed{Title: cleanTitle(ident.Series, source), Kind: KindCollection, Identity: ident}
	}
	parsed := mikan.ParseMikanTitle(source)
	title := cleanTitle(firstNonEmpty(ident.Series, parsed.Title), source)
	if title == "" {
		title = firstNonEmpty(ident.Series, parsed.Title, cleanTitle("", source))
	}
	title = stripEpisodeTail(title)
	year := extractYear(source)
	season := ident.Season
	if season == nil {
		season = parsed.Season
	}
	episode := ident.Episode
	if episode == nil {
		episode = parsed.Episode
	}
	if episode == nil {
		if hit := animeEp.FindStringSubmatch(source); hit != nil {
			n, _ := strconv.Atoi(hit[1])
			if n > 0 && n < 1900 {
				episode = &n
			}
		}
	}
	kind := KindMovie
	if ident.Kind == mikan.KindSpecial || season != nil || episode != nil {
		kind = KindTV
		if looksAnime(source, title) {
			kind = KindAnime
		}
	}
	if ident.Kind == mikan.KindSpecial && season == nil {
		zero := 0
		season = &zero
	}
	return Parsed{
		Title:           title,
		Year:            year,
		Season:          season,
		Episode:         episode,
		Kind:            kind,
		SeasonAmbiguous: ident.SeasonAmbiguous,
		Identity:        ident,
	}
}

func primaryVideo(files []qb.File) qb.File {
	var best qb.File
	for _, file := range files {
		if !rename.IsVideo(file.Name) || rename.IsSkippedExtra(file.Name) {
			continue
		}
		if file.Size >= best.Size {
			best = file
		}
	}
	return best
}

func videoFiles(files []qb.File) []qb.File {
	out := make([]qb.File, 0, len(files))
	for _, file := range files {
		if rename.IsVideo(file.Name) && !rename.IsSkippedExtra(file.Name) {
			out = append(out, file)
		}
	}
	return out
}

func onlyMusic(files []qb.File) bool {
	if len(files) == 0 {
		return false
	}
	hasMusic := false
	for _, file := range files {
		ext := strings.ToLower(path.Ext(strings.ReplaceAll(file.Name, `\`, "/")))
		if rename.IsVideo(file.Name) && !rename.IsSkippedExtra(file.Name) {
			return false
		}
		if _, ok := musicExt[ext]; ok {
			hasMusic = true
		}
	}
	return hasMusic
}

func looksAnime(raw, title string) bool {
	return groupPrefix.MatchString(raw) && cjkRe.MatchString(firstNonEmpty(title, raw))
}

var episodeTail = regexp.MustCompile(`\s*-\s*\d{1,4}\s*$`)

func stripEpisodeTail(title string) string {
	return strings.TrimSpace(episodeTail.ReplaceAllString(title, ""))
}

func extractYear(raw string) int {
	best := 0
	for _, match := range yearRe.FindAllStringSubmatch(raw, -1) {
		year, _ := strconv.Atoi(match[1])
		if year >= 1900 && year <= 2100 && year > best {
			best = year
		}
	}
	return best
}

func cleanTitle(series, raw string) string {
	text := firstNonEmpty(series, raw)
	text = releaseToken.ReplaceAllString(text, " ")
	text = yearRe.ReplaceAllString(text, " ")
	text = groupPrefix.ReplaceAllString(text, " ")
	text = strings.NewReplacer("(", " ", ")", " ", "[", " ", "]", " ").Replace(text)
	text = dotName.ReplaceAllString(text, " ")
	text = strings.Join(strings.Fields(text), " ")
	return strings.TrimSpace(text)
}

func stem(filePath string) string {
	base := path.Base(strings.ReplaceAll(filePath, `\`, "/"))
	i := strings.LastIndex(base, ".")
	if i < 0 {
		return base
	}
	return base[:i]
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func extOf(filePath string) string {
	base := path.Base(strings.ReplaceAll(filePath, `\`, "/"))
	i := strings.LastIndex(base, ".")
	if i < 0 {
		return ""
	}
	return strings.ToLower(base[i:])
}
