package mikan

import (
	"regexp"
	"strings"
	"unicode"
)

type Kind string

const (
	KindEpisode    Kind = "episode"
	KindSpecial    Kind = "special"
	KindCollection Kind = "collection"
)

type AmbiguousHint string

const (
	HintNone  AmbiguousHint = ""
	HintPart  AmbiguousHint = "part"
	HintLast  AmbiguousHint = "last"
	HintFirst AmbiguousHint = "first"
	HintRoman AmbiguousHint = "roman"
)

type Identity struct {
	Series          string
	Season          *int
	Episode         *int
	Kind            Kind
	SeasonAmbiguous bool
	Hint            AmbiguousHint
	HintN           int
}

var zhNum = map[rune]int{
	'零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
	'五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
}

var romanValue = map[string]int{
	"ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10,
	"ⅱ": 2, "ⅲ": 3, "ⅳ": 4, "ⅴ": 5, "ⅵ": 6, "ⅶ": 7, "ⅷ": 8, "ⅸ": 9, "ⅹ": 10,
	"Ⅱ": 2, "Ⅲ": 3, "Ⅳ": 4, "Ⅴ": 5, "Ⅵ": 6, "Ⅶ": 7, "Ⅷ": 8, "Ⅸ": 9, "Ⅹ": 10,
}

var (
	reClearZhDigit  = regexp.MustCompile(`第\s*(\d{1,2})\s*[季期]`)
	reClearZhWord   = regexp.MustCompile(`第\s*([一二三四五六七八九十两零〇]+)\s*[季期]`)
	reClearSeason   = regexp.MustCompile(`(?i)Season\s*(\d{1,2})`)
	reClearNth      = regexp.MustCompile(`(?i)(\d{1,2})(?:st|nd|rd|th)\s*Season`)
	reClearS        = regexp.MustCompile(`(?i)(?:^|[^A-Za-z0-9])S(\d{1,2})(?:[^A-Za-z0-9E]|$)`)
	reAmbiguousPart = regexp.MustCompile(`第\s*(\d{1,2}|[一二三四五六七八九十两零〇]+)\s*部(?:分)?`)
	reAmbiguousArc  = regexp.MustCompile(`前篇|后篇|後篇|续篇|續篇|完结篇|完結篇`)
	reRomanToken    = regexp.MustCompile(`(?i)(?:^|[^A-Za-z])(III|II|IV|VIII|VII|VI|IX|X|Ⅱ|Ⅲ|Ⅳ|Ⅴ|Ⅵ|Ⅶ|Ⅷ|Ⅸ|Ⅹ)(?:[^A-Za-z]|$)`)
	reSpecialTag    = regexp.MustCompile(`(?i)(?:^|[\[【\s（(])(?:SP|OVA|OAD|总集篇|總集篇)(?:[\]】\s）)]|$)`)
	reCollection    = regexp.MustCompile(`合集|全集`)
	reRange         = regexp.MustCompile(`\d{1,3}\s*[-~～]\s*\d{1,3}`)
	reStripClear    = regexp.MustCompile(`第\s*(?:\d{1,2}|[一二三四五六七八九十两零〇]+)\s*[季期]|(?i)Season\s*\d{1,2}|(?i)\d{1,2}(?:st|nd|rd|th)\s*Season|(?i)(?:^|[^A-Za-z0-9])S\d{1,2}(?:[^A-Za-z0-9E]|$)`)
	reStripAmb      = regexp.MustCompile(`第\s*(?:\d{1,2}|[一二三四五六七八九十两零〇]+)\s*部(?:分)?|前篇|后篇|後篇|续篇|續篇|完结篇|完結篇`)
	reQiSeason      = regexp.MustCompile(`第\s*(?:\d{1,2}|[一二三四五六七八九十两零〇]+)\s*期`)
)

func Identify(subscriptionTitle, torrentTitle string) Identity {
	source := strings.TrimSpace(subscriptionTitle)
	if source == "" {
		source = torrentTitle
	}
	series := stripSeasonTokens(source)
	if series == "" {
		series = strings.Join(strings.Fields(strings.TrimSpace(source)), " ")
	}

	kind := KindEpisode
	if isSpecial(torrentTitle) {
		kind = KindSpecial
	} else if isCollection(torrentTitle) {
		kind = KindCollection
	}

	cleaned := reQiSeason.ReplaceAllString(torrentTitle, " ")
	parsed := ParseMikanTitle(cleaned)

	clearSub := extractClearSeason(subscriptionTitle)
	clearTor := extractClearSeason(torrentTitle)
	season := clearSub
	if season == nil {
		season = clearTor
	}
	if season == nil && parsed.Season != nil {
		season = parsed.Season
	}

	id := Identity{Series: series, Season: season, Episode: parsed.Episode, Kind: kind}
	if kind == KindSpecial {
		zero := 0
		id.Season = &zero
		id.SeasonAmbiguous = false
		return id
	}
	if season != nil {
		return id
	}
	if hint, n, ok := extractAmbiguous(subscriptionTitle); ok {
		id.SeasonAmbiguous = true
		id.Hint = hint
		id.HintN = n
		return id
	}
	if hint, n, ok := extractAmbiguous(torrentTitle); ok {
		id.SeasonAmbiguous = true
		id.Hint = hint
		id.HintN = n
	}
	return id
}

func isSpecial(title string) bool {
	return reSpecialTag.MatchString(title)
}

func isCollection(title string) bool {
	return reCollection.MatchString(title) && reRange.MatchString(title)
}

func extractClearSeason(title string) *int {
	if title == "" {
		return nil
	}
	if se := reSE.FindStringSubmatch(title); se != nil {
		s := atoi(se[1])
		return &s
	}
	if hit := reClearNth.FindStringSubmatch(title); hit != nil {
		s := atoi(hit[1])
		return &s
	}
	if hit := reClearSeason.FindStringSubmatch(title); hit != nil {
		s := atoi(hit[1])
		return &s
	}
	if hit := reClearZhDigit.FindStringSubmatch(title); hit != nil {
		s := atoi(hit[1])
		return &s
	}
	if hit := reClearZhWord.FindStringSubmatch(title); hit != nil {
		if s, ok := parseZhNum(hit[1]); ok {
			return &s
		}
	}
	if hit := reClearS.FindStringSubmatch(title); hit != nil {
		s := atoi(hit[1])
		return &s
	}
	return nil
}

func extractAmbiguous(title string) (AmbiguousHint, int, bool) {
	if title == "" {
		return HintNone, 0, false
	}
	if hit := reAmbiguousPart.FindStringSubmatch(title); hit != nil {
		n := atoi(hit[1])
		if n == 0 {
			if z, ok := parseZhNum(hit[1]); ok {
				n = z
			}
		}
		if n > 0 {
			return HintPart, n, true
		}
	}
	if loc := reAmbiguousArc.FindStringIndex(title); loc != nil {
		token := title[loc[0]:loc[1]]
		switch {
		case strings.Contains(token, "前"):
			return HintFirst, 0, true
		default:
			return HintLast, 0, true
		}
	}
	compact := strings.TrimSpace(title)
	runes := []rune(compact)
	if n, ok := trailingRoman(runes); ok {
		return HintRoman, n, true
	}
	if hit := reRomanToken.FindStringSubmatch(title); hit != nil {
		if n, ok := romanValue[hit[1]]; ok {
			return HintRoman, n, true
		}
		if n, ok := romanValue[strings.ToLower(hit[1])]; ok {
			return HintRoman, n, true
		}
	}
	return HintNone, 0, false
}

func trailingRoman(runes []rune) (int, bool) {
	if len(runes) == 0 {
		return 0, false
	}
	last := runes[len(runes)-1]
	if n, ok := romanValue[string(last)]; ok && len(runes) > 1 && isCJK(runes[len(runes)-2]) {
		return n, true
	}
	return 0, false
}

func isCJK(r rune) bool {
	return unicode.In(r, unicode.Han)
}

func stripSeasonTokens(title string) string {
	out := reStripClear.ReplaceAllString(title, " ")
	out = reStripAmb.ReplaceAllString(out, " ")
	out = stripTrailingRoman(out)
	out = reSE.ReplaceAllString(out, " ")
	out = strings.Join(strings.Fields(out), " ")
	return strings.TrimSpace(out)
}

func stripTrailingRoman(title string) string {
	runes := []rune(strings.TrimSpace(title))
	if n := len(runes); n > 1 {
		if _, ok := romanValue[string(runes[n-1])]; ok && isCJK(runes[n-2]) {
			return string(runes[:n-1])
		}
	}
	return title
}

func parseZhNum(raw string) (int, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, false
	}
	if raw == "十" {
		return 10, true
	}
	runes := []rune(raw)
	if len(runes) == 1 {
		n, ok := zhNum[runes[0]]
		return n, ok && n > 0
	}
	if strings.HasPrefix(raw, "二十") {
		rest := strings.TrimPrefix(raw, "二十")
		if rest == "" {
			return 20, true
		}
		if n, ok := zhNum[[]rune(rest)[0]]; ok && n < 10 {
			return 20 + n, true
		}
	}
	if strings.HasPrefix(raw, "十") {
		rest := strings.TrimPrefix(raw, "十")
		if n, ok := zhNum[[]rune(rest)[0]]; ok && n < 10 {
			return 10 + n, true
		}
	}
	if strings.HasSuffix(raw, "十") && len(runes) == 2 {
		if n, ok := zhNum[runes[0]]; ok && n > 0 && n < 10 {
			return n * 10, true
		}
	}
	return 0, false
}
