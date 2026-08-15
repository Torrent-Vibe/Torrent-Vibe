import type { SubscriptionRecord } from '@torrent-vibe/helper-protocol'

import type {
  HelperEpisodeStatus,
  ServerHelperTarget,
} from '~/modules/helper-client'
import type { HelperStatusSnapshot } from '~/modules/subscriptions/store'

const EPISODE_RANK: Record<HelperEpisodeStatus['state'], number> = {
  'downloading': 6,
  'renaming': 5,
  'added': 4,
  'pending': 3,
  'done': 2,
  'failed': 1,
  'needs-manual': 0,
}

export const serverNamesForIds = (
  ids: string[],
  targets: ServerHelperTarget[],
) => ids.map(id => targets.find(target => target.id === id)?.name ?? id)

export const subscriptionsForBangumi = (
  items: SubscriptionRecord[],
  bangumiId: string,
) => items.filter(item => item.bangumiId === bangumiId)

export const latestEpisodeForSubscription = (
  item: SubscriptionRecord,
  statusByServer: Record<string, HelperStatusSnapshot>,
): HelperEpisodeStatus | null => {
  const episodes: HelperEpisodeStatus[] = []
  for (const serverId of item.targetServerIds) {
    const snapshot = statusByServer[serverId]
    const replica = snapshot?.replicas.find(
      entry =>
        entry.bangumiId === item.bangumiId
        && entry.subgroupId === item.subgroupId,
    )
    if (replica) {
      episodes.push(...replica.episodes)
    }
  }
  if (episodes.length === 0) {
    return null
  }
  return (
    [...episodes].sort((a, b) => {
      const rank = EPISODE_RANK[b.state] - EPISODE_RANK[a.state]
      if (rank !== 0) {
        return rank
      }
      return b.title.localeCompare(a.title)
    })[0] ?? null
  )
}

export const episodeStateFor = (
  bangumiId: string,
  subgroupId: string,
  episodeId: string,
  statusByServer: Record<string, HelperStatusSnapshot>,
): HelperEpisodeStatus['state'] | null => {
  for (const snapshot of Object.values(statusByServer)) {
    const replica = snapshot.replicas.find(
      entry =>
        entry.bangumiId === bangumiId && entry.subgroupId === subgroupId,
    )
    const episode = replica?.episodes.find(
      entry => entry.episodeId === episodeId,
    )
    if (episode) {
      return episode.state
    }
  }
  return null
}
