package protocol_test

import (
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
)

func replica(id, title string) protocol.Replica {
	return protocol.Replica{
		ID:           id,
		BangumiID:    "b",
		Title:        title,
		SubgroupID:   "s",
		SubgroupName: "S",
		RSSURL:       "https://x/rss",
	}
}

func TestDesiredStateDiffAddsMissing(t *testing.T) {
	ops := protocol.DesiredStateDiff([]protocol.Replica{replica("1", "A")}, nil)
	if len(ops) != 1 || ops[0].Type != protocol.OpAdd || ops[0].Replica.ID != "1" {
		t.Fatalf("%+v", ops)
	}
}

func TestDesiredStateDiffRemovesExtra(t *testing.T) {
	ops := protocol.DesiredStateDiff(nil, []protocol.Replica{replica("1", "A")})
	if len(ops) != 1 || ops[0].Type != protocol.OpRemove || ops[0].ID != "1" {
		t.Fatalf("%+v", ops)
	}
}

func TestDesiredStateDiffReplaceOnFieldChange(t *testing.T) {
	ops := protocol.DesiredStateDiff(
		[]protocol.Replica{replica("1", "B")},
		[]protocol.Replica{replica("1", "A")},
	)
	if len(ops) != 2 || ops[0].Type != protocol.OpRemove || ops[1].Type != protocol.OpAdd {
		t.Fatalf("%+v", ops)
	}
}

func TestDesiredStateDiffUnchanged(t *testing.T) {
	r := replica("1", "A")
	if ops := protocol.DesiredStateDiff([]protocol.Replica{r}, []protocol.Replica{r}); len(ops) != 0 {
		t.Fatalf("%+v", ops)
	}
}
