package protocol

import "encoding/json"

func replicaKey(replica Replica) string {
	subject := any(nil)
	if replica.BangumiSubjectID != "" {
		subject = replica.BangumiSubjectID
	}
	raw, err := json.Marshal([]any{
		replica.ID,
		replica.BangumiID,
		replica.Title,
		subject,
		replica.SubgroupID,
		replica.SubgroupName,
		replica.RSSURL,
	})
	if err != nil {
		return replica.ID
	}
	return string(raw)
}

func DesiredStateDiff(desired, current []Replica) []DesiredOp {
	desiredByID := make(map[string]Replica, len(desired))
	for _, replica := range desired {
		desiredByID[replica.ID] = replica
	}
	currentByID := make(map[string]Replica, len(current))
	for _, replica := range current {
		currentByID[replica.ID] = replica
	}

	ops := make([]DesiredOp, 0)
	for id, currentReplica := range currentByID {
		desiredReplica, ok := desiredByID[id]
		if !ok || replicaKey(desiredReplica) != replicaKey(currentReplica) {
			ops = append(ops, DesiredOp{Type: OpRemove, ID: id})
		}
	}
	for id, desiredReplica := range desiredByID {
		currentReplica, ok := currentByID[id]
		if !ok || replicaKey(desiredReplica) != replicaKey(currentReplica) {
			ops = append(ops, DesiredOp{Type: OpAdd, Replica: desiredReplica})
		}
	}
	return ops
}
