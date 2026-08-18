package rename

import (
	"fmt"
	"path"
	"regexp"
	"strings"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/qb"
)

type Plan struct {
	From string
	To   string
}

var (
	videoExt = map[string]struct{}{
		".mkv": {}, ".mp4": {}, ".avi": {}, ".ts": {}, ".m2ts": {},
		".mts": {}, ".webm": {}, ".mov": {}, ".wmv": {}, ".flv": {},
	}
	subExt = map[string]struct{}{
		".srt": {}, ".ass": {}, ".ssa": {}, ".sub": {}, ".vtt": {}, ".idx": {}, ".sup": {},
	}
	extraToken = regexp.MustCompile(`(?i)(^|[\\/._\-\s])(sample|ncop|nced|extras?)($|[\\/._\-\s])`)
	unsafeSeg  = regexp.MustCompile(`[\\/:*?"<>|]`)
)

func IsVideo(filePath string) bool {
	_, ok := videoExt[extname(filePath)]
	return ok
}

func IsSkippedExtra(filePath string) bool {
	return isSkippedExtra(filePath)
}

func SanitizeTitle(title string) string {
	safe := unsafeSeg.ReplaceAllString(title, "_")
	safe = strings.TrimSpace(safe)
	return strings.TrimRight(safe, " .")
}

func FormatEpisodeName(title string, season, episode int) string {
	return fmt.Sprintf("%s - S%02dE%02d", title, season, episode)
}

func FormatSavePath(libraryRoot, title string, season int) string {
	seasonDir := fmt.Sprintf("Season %02d", season)
	safeTitle := unsafeSeg.ReplaceAllString(title, "_")
	safeTitle = strings.TrimSpace(safeTitle)
	if libraryRoot == "" {
		return safeTitle + "/" + seasonDir
	}
	sep := "/"
	if strings.Contains(libraryRoot, `\`) && !strings.Contains(libraryRoot, "/") {
		sep = `\`
	}
	return strings.TrimRight(libraryRoot, `/\`) + sep + safeTitle + sep + seasonDir
}

func PlanEpisodeRenames(displayName string, files []qb.File) []Plan {
	usable := make([]qb.File, 0, len(files))
	for _, file := range files {
		if isSkippedExtra(file.Name) {
			continue
		}
		usable = append(usable, file)
	}
	var videos []qb.File
	for _, file := range usable {
		if _, ok := videoExt[extname(file.Name)]; ok {
			videos = append(videos, file)
		}
	}
	if len(videos) == 0 {
		return nil
	}
	primary := videos[0]
	for _, file := range videos[1:] {
		if file.Size > primary.Size {
			primary = file
		}
	}
	primaryStem := stem(primary.Name)
	dir := dirname(primary.Name)
	var plans []Plan
	videoTo := joinDir(dir, displayName+extname(primary.Name))
	if primary.Name != videoTo {
		plans = append(plans, Plan{From: primary.Name, To: videoTo})
	}
	for _, file := range usable {
		if _, ok := subExt[extname(file.Name)]; !ok {
			continue
		}
		subStem := stem(file.Name)
		if subStem != primaryStem && !strings.HasPrefix(subStem, primaryStem) {
			continue
		}
		extra := strings.TrimPrefix(subStem, primaryStem)
		subTo := joinDir(dir, displayName+extra+extname(file.Name))
		if file.Name != subTo {
			plans = append(plans, Plan{From: file.Name, To: subTo})
		}
	}
	return plans
}

func isSkippedExtra(filePath string) bool {
	for _, part := range strings.FieldsFunc(filePath, func(r rune) bool {
		return r == '/' || r == '\\'
	}) {
		if extraToken.MatchString(part) {
			return true
		}
	}
	return false
}

func extname(filePath string) string {
	base := basename(filePath)
	i := strings.LastIndex(base, ".")
	if i < 0 {
		return ""
	}
	return strings.ToLower(base[i:])
}

func basename(filePath string) string {
	return path.Base(strings.ReplaceAll(filePath, `\`, "/"))
}

func dirname(filePath string) string {
	normalized := strings.ReplaceAll(filePath, `\`, "/")
	dir := path.Dir(normalized)
	if dir == "." {
		return ""
	}
	if strings.Contains(filePath, `\`) && !strings.Contains(filePath, "/") {
		return strings.ReplaceAll(dir, "/", `\`)
	}
	return dir
}

func stem(filePath string) string {
	base := basename(filePath)
	i := strings.LastIndex(base, ".")
	if i < 0 {
		return base
	}
	return base[:i]
}

func joinDir(dir, name string) string {
	if dir == "" {
		return name
	}
	sep := "/"
	if strings.Contains(dir, `\`) && !strings.Contains(dir, "/") {
		sep = `\`
	}
	return dir + sep + name
}
