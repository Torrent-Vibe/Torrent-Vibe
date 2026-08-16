package protocol

type EpisodeState string

const (
	StatePending     EpisodeState = "pending"
	StateAdded       EpisodeState = "added"
	StateDownloading EpisodeState = "downloading"
	StateRenaming    EpisodeState = "renaming"
	StateDone        EpisodeState = "done"
	StateFailed      EpisodeState = "failed"
	StateNeedsManual EpisodeState = "needs-manual"
)

type Replica struct {
	ID               string `json:"id"`
	BangumiID        string `json:"bangumiId"`
	Title            string `json:"title"`
	BangumiSubjectID string `json:"bangumiSubjectId,omitempty"`
	SubgroupID       string `json:"subgroupId"`
	SubgroupName     string `json:"subgroupName"`
	RSSURL           string `json:"rssUrl"`
}

type OpType string

const (
	OpAdd    OpType = "add"
	OpRemove OpType = "remove"
)

type DesiredOp struct {
	Type    OpType
	ID      string
	Replica Replica
}
