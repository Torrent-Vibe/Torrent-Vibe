import type { SubscriptionRecord } from '@torrent-vibe/helper-protocol'

export const subscribedSubgroupIds = (
  subscriptions: SubscriptionRecord[],
  bangumiId: string,
): Set<string> =>
  new Set(
    subscriptions
      .filter((entry) => entry.bangumiId === bangumiId)
      .map((entry) => entry.subgroupId),
  )

export interface OtherSubscribedSubgroup {
  subgroupId: string
  subgroupName: string
}

export const findOtherSubscribedSubgroup = (
  subscriptions: SubscriptionRecord[],
  bangumiId: string,
  selectedSubgroupId: string | null,
): OtherSubscribedSubgroup | null => {
  const forBangumi = subscriptions.filter(
    (entry) => entry.bangumiId === bangumiId,
  )
  const selectedIsSubscribed = forBangumi.some(
    (entry) => entry.subgroupId === selectedSubgroupId,
  )
  if (selectedIsSubscribed) {
    return null
  }
  const other = forBangumi[0]
  return other
    ? { subgroupId: other.subgroupId, subgroupName: other.subgroupName }
    : null
}
