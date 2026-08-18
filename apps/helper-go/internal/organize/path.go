package organize

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/rename"
)

func libraryRelPath(parsed Parsed, title string, year int, ext string) string {
	safeTitle := rename.SanitizeTitle(title)
	if safeTitle == "" {
		safeTitle = "Unknown"
	}
	switch parsed.Kind {
	case KindMovie:
		folder := movieFolder(safeTitle, year)
		return filepath.ToSlash(filepath.Join("Movies", folder, folder+ext))
	default:
		season := 1
		if parsed.Identity.Kind == "special" || (parsed.Season != nil && *parsed.Season == 0) {
			season = 0
		} else if parsed.Season != nil {
			season = *parsed.Season
		}
		episode := 0
		if parsed.Episode != nil {
			episode = *parsed.Episode
		}
		name := rename.FormatEpisodeName(safeTitle, season, episode)
		return filepath.ToSlash(filepath.Join("TV", safeTitle, fmt.Sprintf("Season %02d", season), name+ext))
	}
}

func movieFolder(title string, year int) string {
	if year > 0 {
		return fmt.Sprintf("%s (%d)", title, year)
	}
	return title
}

func joinSource(savePath, name string) string {
	normalized := filepath.FromSlash(strings.ReplaceAll(name, `\`, "/"))
	if savePath == "" {
		return normalized
	}
	return filepath.Join(savePath, normalized)
}

func underRoot(root, dest string) bool {
	if root == "" {
		return false
	}
	cleanRoot := filepath.Clean(root)
	cleanDest := filepath.Clean(dest)
	rel, err := filepath.Rel(cleanRoot, cleanDest)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
