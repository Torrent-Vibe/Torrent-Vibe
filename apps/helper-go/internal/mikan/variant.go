package mikan

import (
	"regexp"
	"strconv"
	"strings"
)

type Language string

const (
	LangInternal Language = "internal"
	LangSC       Language = "sc"
	LangTC       Language = "tc"
	LangUnset    Language = ""
)

const (
	SkipReasonResolution = "skipped-resolution"
	SkipReasonLanguage   = "skipped-language"
	DefaultVariantPrefer = "internal,sc,tc"
)

type VariantItem struct {
	Index      int
	Language   Language
	Resolution int
}

type PickLoser struct {
	Index  int
	Reason string
}

var (
	internalExact = []string{
		"简繁内封", "简繁日内封", "简繁英内封", "简繁日英内封",
		"繁简内封", "繁简外挂", "简繁外挂",
	}
	scCJK = []string{
		"简体内嵌", "简日内嵌", "简体内", "简日内",
		"简日双语", "中日双语", "日中双语",
		"简体", "简日", "简中", "中日",
	}
	tcCJK = []string{
		"繁体内嵌", "繁日内嵌", "繁体内", "繁日内", "繁日双语",
		"繁体", "繁日", "繁中",
	}
	defaultPrefer = []Language{LangInternal, LangSC, LangTC}

	reInternalPair = regexp.MustCompile(`(?i)(?:cht\s*[&＋+]\s*chs|chs\s*[&＋+]\s*cht|gb\s*[&＋+]\s*big5|big5\s*[&＋+]\s*gb)`)
	reRawBracket   = regexp.MustCompile(`(?i)\[[^\]]*\braw\b[^\]]*\]`)
	re8K           = regexp.MustCompile(`(?i)(?:^|[^a-z0-9])8k(?:[^a-z0-9]|$)`)
	re4K           = regexp.MustCompile(`(?i)(?:^|[^a-z0-9])4k(?:[^a-z0-9]|$)`)
	reResP         = regexp.MustCompile(`(?i)(\d{3,4})\s*p`)
	reResX         = regexp.MustCompile(`(?i)(\d{3,4})\s*x\s*(\d{3,4})`)
	reResBare      = regexp.MustCompile(`(?i)(?:^|[^0-9])(720|1080|1440|2160|4320)(?:[^0-9]|$)`)
	asciiTokenRe   = map[string]*regexp.Regexp{
		"jpsc": regexp.MustCompile(`(?i)(?:^|[^a-z0-9])jpsc(?:[^a-z0-9]|$)`),
		"chs":  regexp.MustCompile(`(?i)(?:^|[^a-z0-9])chs(?:[^a-z0-9]|$)`),
		"gb":   regexp.MustCompile(`(?i)(?:^|[^a-z0-9])gb(?:[^a-z0-9]|$)`),
		"sc":   regexp.MustCompile(`(?i)(?:^|[^a-z0-9])sc(?:[^a-z0-9]|$)`),
		"big5": regexp.MustCompile(`(?i)(?:^|[^a-z0-9])big5(?:[^a-z0-9]|$)`),
		"cht":  regexp.MustCompile(`(?i)(?:^|[^a-z0-9])cht(?:[^a-z0-9]|$)`),
		"tc":   regexp.MustCompile(`(?i)(?:^|[^a-z0-9])tc(?:[^a-z0-9]|$)`),
	}
	rungExact = map[int]int{
		720: 720, 1080: 1080, 1440: 1440, 2160: 2160, 4320: 4320,
		1280: 720, 1920: 1080, 2560: 1440, 3840: 2160, 7680: 4320,
	}
)

func ClassifyLanguage(title string) Language {
	compact := strings.ReplaceAll(title, " ", "")
	for _, key := range internalExact {
		if strings.Contains(compact, key) {
			return LangInternal
		}
	}
	if (strings.Contains(compact, "简繁") || strings.Contains(compact, "繁简")) &&
		(strings.Contains(compact, "内封") || strings.Contains(compact, "外挂")) {
		return LangInternal
	}
	if reInternalPair.MatchString(title) {
		return LangInternal
	}
	if strings.Contains(compact, "简繁") || strings.Contains(compact, "繁简") {
		return LangUnset
	}
	if strings.Contains(compact, "无字幕") || strings.Contains(compact, "生肉") || reRawBracket.MatchString(title) {
		return LangUnset
	}
	for _, key := range scCJK {
		if strings.Contains(compact, key) {
			return LangSC
		}
	}
	for _, token := range []string{"jpsc", "chs", "gb", "sc"} {
		if asciiTokenRe[token].MatchString(title) {
			return LangSC
		}
	}
	for _, key := range tcCJK {
		if strings.Contains(compact, key) {
			return LangTC
		}
	}
	for _, token := range []string{"big5", "cht", "tc"} {
		if asciiTokenRe[token].MatchString(title) {
			return LangTC
		}
	}
	return LangUnset
}

func ClassifyResolution(title string) (int, bool) {
	best := 0
	found := false
	consider := func(n int) {
		rung, ok := mapRung(n)
		if !ok {
			return
		}
		if !found || rung > best {
			best, found = rung, true
		}
	}
	if re8K.MatchString(title) {
		consider(4320)
	}
	if re4K.MatchString(title) {
		consider(2160)
	}
	for _, match := range reResP.FindAllStringSubmatch(title, -1) {
		n, _ := strconv.Atoi(match[1])
		consider(n)
	}
	for _, match := range reResX.FindAllStringSubmatch(title, -1) {
		a, _ := strconv.Atoi(match[1])
		b, _ := strconv.Atoi(match[2])
		if a < b {
			consider(a)
		} else {
			consider(b)
		}
	}
	if !found {
		if match := reResBare.FindStringSubmatch(title); match != nil {
			n, _ := strconv.Atoi(match[1])
			consider(n)
		}
	}
	return best, found
}

func mapRung(n int) (int, bool) {
	if rung, ok := rungExact[n]; ok {
		return rung, true
	}
	switch {
	case n >= 700 && n <= 800:
		return 720, true
	case n >= 1000 && n <= 1200:
		return 1080, true
	case n >= 2000 && n <= 2300:
		return 2160, true
	default:
		return 0, false
	}
}

func ParseVariantPrefer(raw string) []Language {
	list, ok := parsePrefer(raw)
	if !ok {
		return append([]Language(nil), defaultPrefer...)
	}
	return list
}

func ValidVariantPrefer(raw string) bool {
	if strings.TrimSpace(raw) == "" {
		return true
	}
	_, ok := parsePrefer(raw)
	return ok
}

func EffectiveVariantPrefer(raw string) string {
	list := ParseVariantPrefer(raw)
	parts := make([]string, len(list))
	for i, lang := range list {
		parts[i] = string(lang)
	}
	return strings.Join(parts, ",")
}

func parsePrefer(raw string) ([]Language, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, false
	}
	parts := strings.Split(raw, ",")
	if len(parts) != 3 {
		return nil, false
	}
	seen := map[Language]struct{}{}
	out := make([]Language, 0, 3)
	for _, part := range parts {
		lang := Language(strings.ToLower(strings.TrimSpace(part)))
		if lang != LangInternal && lang != LangSC && lang != LangTC {
			return nil, false
		}
		if _, dup := seen[lang]; dup {
			return nil, false
		}
		seen[lang] = struct{}{}
		out = append(out, lang)
	}
	return out, true
}

func PickVariant(items []VariantItem, prefer []Language) (VariantItem, []PickLoser) {
	if len(prefer) == 0 {
		prefer = ParseVariantPrefer("")
	}
	if len(items) == 0 {
		return VariantItem{Index: -1}, nil
	}
	winner := items[0]
	var losers []PickLoser
	for _, item := range items[1:] {
		next, loser, reason := betterVariant(winner, item, prefer)
		if next.Index == item.Index {
			losers = append(losers, PickLoser{Index: winner.Index, Reason: reason})
			winner = item
			continue
		}
		losers = append(losers, PickLoser{Index: loser.Index, Reason: reason})
	}
	return winner, losers
}

func betterVariant(a, b VariantItem, prefer []Language) (VariantItem, VariantItem, string) {
	if a.Resolution > 0 && b.Resolution > 0 && a.Resolution != b.Resolution {
		if a.Resolution > b.Resolution {
			return a, b, SkipReasonResolution
		}
		return b, a, SkipReasonResolution
	}
	ra, rb := languageRank(a.Language, prefer), languageRank(b.Language, prefer)
	if ra < rb {
		return a, b, SkipReasonLanguage
	}
	if rb < ra {
		return b, a, SkipReasonLanguage
	}
	if a.Index <= b.Index {
		return a, b, SkipReasonLanguage
	}
	return b, a, SkipReasonLanguage
}

func languageRank(lang Language, prefer []Language) int {
	for i, item := range prefer {
		if item == lang {
			return i
		}
	}
	return len(prefer)
}
