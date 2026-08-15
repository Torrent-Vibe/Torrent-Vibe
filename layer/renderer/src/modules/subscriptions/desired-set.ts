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
    .filter(item => item.targetServerIds.includes(serverId))
    .map(toHelperReplica)
