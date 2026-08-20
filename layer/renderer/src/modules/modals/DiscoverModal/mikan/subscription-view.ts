import type { SubscriptionRecord } from '@torrent-vibe/helper-protocol'

import type {
  HelperEpisodeStatus,
  ServerHelperTarget,
} from '~/modules/helper-client'
import type { HelperStatusSnapshot } from '~/modules/subscriptions/store'

import { episodeStateLabelKey } from './episode-state'

const compareEpisodeRecency = (
  left: HelperEpisodeStatus,
  right: HelperEpisodeStatus,
) => {
  const season = (right.season ?? 1) - (left.season ?? 1)
  if (season !== 0) {
    return season
  }
  const episode = (right.episode ?? -1) - (left.episode ?? -1)
  if (episode !== 0) {
    return episode
  }
  return right.title.localeCompare(left.title)
}

export const serverNamesForIds = (
  ids: string[],
  targets: ServerHelperTarget[],
) => ids.map((id) => targets.find((target) => target.id === id)?.name ?? id)

export const subscriptionsForBangumi = (
  items: SubscriptionRecord[],
  bangumiId: string,
) => items.filter((item) => item.bangumiId === bangumiId)

export const latestEpisodeForSubscription = (
  item: SubscriptionRecord,
  statusByServer: Record<string, HelperStatusSnapshot>,
): HelperEpisodeStatus | null => {
  const episodes: HelperEpisodeStatus[] = []
  for (const serverId of item.targetServerIds) {
    const snapshot = statusByServer[serverId]
    const replica = snapshot?.replicas.find(
      (entry) =>
        entry.bangumiId === item.bangumiId &&
        entry.subgroupId === item.subgroupId,
    )
    if (replica) {
      episodes.push(...replica.episodes)
    }
  }
  if (episodes.length === 0) {
    return null
  }
  return [...episodes].sort(compareEpisodeRecency)[0] ?? null
}

export const lastRenameDisplay = (
  episode: HelperEpisodeStatus,
): { text: string } | { key: I18nKeys } | null => {
  if (episode.lastError) {
    return { text: episode.lastError }
  }
  if (
    episode.state === 'done' ||
    episode.state === 'failed' ||
    episode.state === 'needs-manual'
  ) {
    return { key: episodeStateLabelKey(episode.state) }
  }
  return null
}
