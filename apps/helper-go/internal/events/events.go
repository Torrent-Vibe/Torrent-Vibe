package events

import "time"

const (
	RingCapacity      = 2000
	DefaultQueryLimit = 200
	MaxQueryLimit     = 1000
	RetentionDays     = 7
)

type Event struct {
	Seq        uint64         `json:"seq"`
	At         time.Time      `json:"at"`
	Level      string         `json:"level"` // debug|info|warn|error
	Kind       string         `json:"kind"`
	ReplicaID  string         `json:"replicaId,omitempty"`
	BangumiID  string         `json:"bangumiId,omitempty"`
	SubgroupID string         `json:"subgroupId,omitempty"`
	EpisodeID  string         `json:"episodeId,omitempty"`
	Message    string         `json:"message"`
	Fields     map[string]any `json:"fields,omitempty"`
}

type Query struct {
	Since     uint64
	Level     string
	ReplicaID string
	Kind      string
	Limit     int
}

type Recorder interface {
	Emit(Event)
	Query(Query) ([]Event, uint64)
}

type Sanitizer func(Event) Event
