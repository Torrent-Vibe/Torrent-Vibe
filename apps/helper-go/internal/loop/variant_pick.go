package loop

import (
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

type variantCandidate struct {
	item         mikan.RssEpisode
	infohash     string
	season       int
	episode      int
	series       string
	kind         mikan.Kind
	lang         mikan.Language
	res          int
	okRes        bool
	skip         bool
	reason       string
	rival        string
	manual       bool
	manualReason string
}

type variantKey struct {
	season  int
	episode int
}

func applyVariantPick(candidates []*variantCandidate, stored []store.Episode, prefer []mikan.Language) {
	committed := map[variantKey]store.Episode{}
	for _, item := range stored {
		if !isCommitted(item.State) || item.Episode == nil {
			continue
		}
		season := 1
		if item.Season != nil {
			season = *item.Season
		}
		key := variantKey{season: season, episode: *item.Episode}
		if _, exists := committed[key]; !exists {
			committed[key] = item
		}
	}
	groups := map[variantKey][]*variantCandidate{}
	for _, candidate := range candidates {
		if candidate.manual || candidate.lang == mikan.LangUnset {
			continue
		}
		key := variantKey{season: candidate.season, episode: candidate.episode}
		groups[key] = append(groups[key], candidate)
	}
	for key, members := range groups {
		if existing, ok := committed[key]; ok {
			existingRung, existingOK := mikan.ClassifyResolution(existing.Title)
			for _, member := range members {
				member.skip = true
				member.rival = existing.Title
				if existingOK && member.okRes && member.res > existingRung {
					member.reason = mikan.SkipReasonResolution
				} else {
					member.reason = mikan.SkipReasonLanguage
				}
			}
			continue
		}
		if len(members) < 2 {
			continue
		}
		items := make([]mikan.VariantItem, len(members))
		for i, member := range members {
			res := 0
			if member.okRes {
				res = member.res
			}
			items[i] = mikan.VariantItem{Index: i, Language: member.lang, Resolution: res}
		}
		winner, losers := mikan.PickVariant(items, prefer)
		for _, loser := range losers {
			members[loser.Index].skip = true
			members[loser.Index].reason = loser.Reason
			members[loser.Index].rival = members[winner.Index].item.Title
		}
	}
}

func isCommitted(state protocol.EpisodeState) bool {
	return state == protocol.StateAdded ||
		state == protocol.StateDownloading ||
		state == protocol.StateRenaming ||
		state == protocol.StateDone
}
