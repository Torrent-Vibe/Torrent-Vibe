package mikan

import (
	"regexp"
	"strconv"
	"strings"
)

type ParsedTitle struct {
	Title   string
	Season  *int
	Episode *int
}

var qualityNumbers = map[int]struct{}{
	360: {}, 480: {}, 720: {}, 1080: {}, 1440: {}, 2160: {}, 4320: {},
}

var (
	reSE          = regexp.MustCompile(`(?i)S(\d{1,2})E(\d{1,4})`)
	reSeasonZh    = regexp.MustCompile(`第(\d{1,2})季`)
	reSeasonEn    = regexp.MustCompile(`(?i)Season\s*(\d{1,2})`)
	reJi          = regexp.MustCompile(`第\s*(\d{1,4})\s*[集话話期]`)
	reDash        = regexp.MustCompile(`(?i)(?:^|[^0-9])-\s*(\d{1,4})`)
	reDashFollow  = regexp.MustCompile(`(?i)^\s*(\[|v\d|$)`)
	reTagNum      = regexp.MustCompile(`(?i)\[(\d{1,4})(?:v\d+)?\]`)
	reBrackets    = regexp.MustCompile(`\[[^\]]*\]`)
	reOrdinal     = regexp.MustCompile(`第\s*\d+\s*[集话話期季]`)
	reDashNumber  = regexp.MustCompile(`(?:^|\D)-\s*\d+\b`)
	reEdgePunct   = regexp.MustCompile(`^[-–—/:：]+|[-–—/:：]+$`)
	reCJK         = regexp.MustCompile(`[\x{3400}-\x{9FFF}]`)
)

func ParseMikanTitle(raw string) ParsedTitle {
	text := strings.TrimSpace(raw)
	if text == "" {
		return ParsedTitle{}
	}

	working := text
	var season, episode *int

	if se := reSE.FindStringSubmatch(working); se != nil {
		s := atoi(se[1])
		e := atoi(se[2])
		season = &s
		episode = &e
		working = strings.Replace(working, se[0], " ", 1)
	}

	if season == nil {
		hit := reSeasonZh.FindStringSubmatch(working)
		if hit == nil {
			hit = reSeasonEn.FindStringSubmatch(working)
		}
		if hit != nil {
			s := atoi(hit[1])
			season = &s
			working = strings.Replace(working, hit[0], " ", 1)
		}
	}

	if episode == nil {
		if ji := reJi.FindStringSubmatch(working); ji != nil {
			e := atoi(ji[1])
			episode = &e
			working = strings.Replace(working, ji[0], " ", 1)
		}
	}

	if episode == nil {
		if loc := reDash.FindStringSubmatchIndex(working); loc != nil {
			rest := working[loc[1]:]
			if reDashFollow.MatchString(rest) {
				e := atoi(working[loc[2]:loc[3]])
				episode = &e
				re := regexp.MustCompile(`-\s*` + regexp.QuoteMeta(working[loc[2]:loc[3]]))
				working = re.ReplaceAllString(working, " ")
			}
		}
	}

	if episode == nil {
		for _, tag := range reTagNum.FindAllStringSubmatch(working, -1) {
			value := atoi(tag[1])
			if _, quality := qualityNumbers[value]; !quality && value < 1900 {
				episode = &value
				working = strings.Replace(working, tag[0], " ", 1)
				break
			}
		}
	}

	title := reBrackets.ReplaceAllString(working, " ")
	title = reOrdinal.ReplaceAllString(title, " ")
	title = reDashNumber.ReplaceAllString(title, " ")
	title = strings.Join(strings.Fields(title), " ")
	title = strings.TrimSpace(title)

	if strings.Contains(title, "/") {
		parts := strings.Split(title, "/")
		var kept []string
		for _, part := range parts {
			part = strings.TrimSpace(part)
			if part != "" {
				kept = append(kept, part)
			}
		}
		chosen := title
		for _, part := range kept {
			if reCJK.MatchString(part) {
				chosen = part
				break
			}
		}
		if chosen == title && len(kept) > 0 {
			chosen = kept[len(kept)-1]
		}
		title = strings.TrimSpace(chosen)
	}

	title = reEdgePunct.ReplaceAllString(title, "")
	title = strings.TrimSpace(title)
	return ParsedTitle{Title: title, Season: season, Episode: episode}
}

func atoi(raw string) int {
	n, _ := strconv.Atoi(raw)
	return n
}
