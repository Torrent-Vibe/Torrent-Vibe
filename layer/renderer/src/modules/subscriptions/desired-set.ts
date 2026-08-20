import type {
  HelperReplica,
  SubscriptionRecord,
} from '@torrent-vibe/helper-protocol'

export const toHelperReplica = (item: SubscriptionRecord): HelperReplica => {
  const replica: HelperReplica = {
    id: item.id,
    bangumiId: item.bangumiId,
    title: item.title,
    subgroupId: item.subgroupId,
    subgroupName: item.subgroupName,
    rssUrl: item.rssUrl,
  }
  if (item.bangumiSubjectId) {
    replica.bangumiSubjectId = item.bangumiSubjectId
  }
  return replica
}

export const desiredReplicasForServer = (
  items: SubscriptionRecord[],
  serverId: string,
): HelperReplica[] =>
  items
    .filter((item) => item.targetServerIds.includes(serverId))
    .map(toHelperReplica)

export const replicaIdentity = (replica: HelperReplica) =>
  `${replica.bangumiId}::${replica.subgroupId}`

export const subscriptionIdentity = (bangumiId: string, subgroupId: string) =>
  `${bangumiId}::${subgroupId}`

export const mergeDesiredReplicas = (input: {
  desired: HelperReplica[]
  remote: HelperReplica[]
  removals?: Iterable<string>
}): HelperReplica[] => {
  const desiredByIdentity = new Map(
    input.desired.map((replica) => [replicaIdentity(replica), replica]),
  )
  const dropped = new Set(input.removals ?? [])
  const merged: HelperReplica[] = []
  const placed = new Set<string>()
  for (const replica of input.remote) {
    const identity = replicaIdentity(replica)
    if (dropped.has(identity)) {
      continue
    }
    placed.add(identity)
    const wanted = desiredByIdentity.get(identity)
    merged.push(wanted ? { ...wanted, id: replica.id } : replica)
  }
  for (const replica of input.desired) {
    if (!placed.has(replicaIdentity(replica))) {
      merged.push(replica)
    }
  }
  return merged
}
