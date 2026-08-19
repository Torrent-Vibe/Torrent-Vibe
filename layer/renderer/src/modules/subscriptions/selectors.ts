import type {
  HelperEpisodeState,
  SubscriptionRecord,
} from '@torrent-vibe/helper-protocol'

import type { HelperReplicaStatus } from '../helper-client'
import type { HelperStatusSnapshot, SubscriptionsState } from './store'
import { subscriptionKey } from './store'

export const EPISODE_STATE_RANK: Record<HelperEpisodeState, number> = {
  failed: 0,
  'needs-manual': 1,
  pending: 2,
  added: 3,
  downloading: 4,
  renaming: 5,
  skipped: 6,
  done: 7,
}

export type SubscriptionSource = 'cache' | 'helper' | 'optimistic'

export interface SubscriptionTargetHealth {
  checkedAt?: string
  checkError?: string
  consecutiveFailures?: number
  reachable: boolean
  serverId: string
}

export interface ResolvedSubscription {
  record: SubscriptionRecord
  source: SubscriptionSource
  targets: SubscriptionTargetHealth[]
}

const findHelperReplica = (
  bangumiId: string,
  subgroupId: string,
  snapshot: HelperStatusSnapshot | undefined,
): HelperReplicaStatus | undefined =>
  snapshot?.replicas.find(
    (entry) => entry.bangumiId === bangumiId && entry.subgroupId === subgroupId,
  )

const buildTargetHealth = (
  targetServerIds: string[],
  bangumiId: string,
  subgroupId: string,
  statusByServer: SubscriptionsState['statusByServer'],
): SubscriptionTargetHealth[] =>
  targetServerIds.map((serverId) => {
    const snapshot = statusByServer[serverId]
    const replica = findHelperReplica(bangumiId, subgroupId, snapshot)
    const health: SubscriptionTargetHealth = {
      serverId,
      reachable: Boolean(snapshot) && !snapshot?.error,
    }
    if (replica?.checkedAt !== undefined) {
      health.checkedAt = replica.checkedAt
    }
    if (replica?.checkError !== undefined) {
      health.checkError = replica.checkError
    }
    if (replica?.consecutiveFailures !== undefined) {
      health.consecutiveFailures = replica.consecutiveFailures
    }
    return health
  })

const recordFromHelperReplica = (
  replica: HelperReplicaStatus,
  targetServerIds: string[],
  fetchedAt: string,
): SubscriptionRecord => {
  const record: SubscriptionRecord = {
    id: replica.id,
    providerId: 'mikan',
    bangumiId: replica.bangumiId,
    title: replica.title,
    subgroupId: replica.subgroupId,
    subgroupName: replica.subgroupName,
    rssUrl: replica.rssUrl,
    targetServerIds,
    syncByServer: Object.fromEntries(
      targetServerIds.map((id) => [id, { status: 'ok' as const }]),
    ),
    createdAt: fetchedAt,
    updatedAt: fetchedAt,
  }
  if (replica.bangumiSubjectId) {
    record.bangumiSubjectId = replica.bangumiSubjectId
  }
  return record
}

export const subscriptionFor = (
  bangumiId: string,
  subgroupId: string,
  state: SubscriptionsState,
): ResolvedSubscription | null => {
  const key = subscriptionKey(bangumiId, subgroupId)
  const optimistic = state.optimistic[key]
  if (optimistic?.type === 'unsubscribe') {
    return null
  }
  if (optimistic?.type === 'subscribe') {
    return {
      record: optimistic.record,
      source: 'optimistic',
      targets: buildTargetHealth(
        optimistic.record.targetServerIds,
        bangumiId,
        subgroupId,
        state.statusByServer,
      ),
    }
  }

  const cached = state.items.find(
    (item) => item.bangumiId === bangumiId && item.subgroupId === subgroupId,
  )
  const scanServerIds =
    cached?.targetServerIds ?? Object.keys(state.statusByServer)
  const helperHits = scanServerIds
    .map((serverId) => ({
      serverId,
      replica: findHelperReplica(
        bangumiId,
        subgroupId,
        state.statusByServer[serverId],
      ),
    }))
    .filter(
      (hit): hit is { replica: HelperReplicaStatus; serverId: string } =>
        hit.replica !== undefined,
    )

  if (helperHits.length > 0) {
    const targetServerIds =
      cached?.targetServerIds ?? helperHits.map((hit) => hit.serverId)
    const fetchedAt =
      state.statusByServer[helperHits[0].serverId]?.fetchedAt ??
      new Date().toISOString()
    const record = cached
      ? { ...cached, targetServerIds }
      : recordFromHelperReplica(
          helperHits[0].replica,
          targetServerIds,
          fetchedAt,
        )
    return {
      record,
      source: 'helper',
      targets: buildTargetHealth(
        targetServerIds,
        bangumiId,
        subgroupId,
        state.statusByServer,
      ),
    }
  }

  if (cached) {
    return {
      record: cached,
      source: 'cache',
      targets: buildTargetHealth(
        cached.targetServerIds,
        bangumiId,
        subgroupId,
        state.statusByServer,
      ),
    }
  }

  return null
}

export const episodeStateFor = (
  targetServerIds: string[],
  bangumiId: string,
  subgroupId: string,
  episodeId: string,
  statusByServer: SubscriptionsState['statusByServer'],
): HelperEpisodeState | null => {
  let resolved: HelperEpisodeState | null = null
  for (const serverId of targetServerIds) {
    const snapshot = statusByServer[serverId]
    if (!snapshot) {
      continue
    }
    const job = snapshot.jobs.find(
      (entry) =>
        entry.bangumiId === bangumiId && entry.subgroupId === subgroupId,
    )
    const replica = findHelperReplica(bangumiId, subgroupId, snapshot)
    const episode =
      job?.episodes.find((entry) => entry.episodeId === episodeId) ??
      replica?.episodes.find((entry) => entry.episodeId === episodeId)
    if (!episode) {
      continue
    }
    if (
      resolved === null ||
      EPISODE_STATE_RANK[episode.state] < EPISODE_STATE_RANK[resolved]
    ) {
      resolved = episode.state
    }
  }
  return resolved
}

export interface SubscriptionProgress {
  failed: number
  ready: number
  total: number
}

export const subscriptionProgress = (
  record: SubscriptionRecord,
  state: SubscriptionsState,
): SubscriptionProgress => {
  const resolvedEpisodes = new Map<string, HelperEpisodeState>()
  for (const serverId of record.targetServerIds) {
    const replica = findHelperReplica(
      record.bangumiId,
      record.subgroupId,
      state.statusByServer[serverId],
    )
    if (!replica) {
      continue
    }
    for (const episode of replica.episodes) {
      const current = resolvedEpisodes.get(episode.episodeId)
      if (
        !current ||
        EPISODE_STATE_RANK[episode.state] < EPISODE_STATE_RANK[current]
      ) {
        resolvedEpisodes.set(episode.episodeId, episode.state)
      }
    }
  }

  let ready = 0
  let failed = 0
  for (const episodeState of resolvedEpisodes.values()) {
    if (episodeState === 'done') {
      ready++
    }
    if (episodeState === 'failed' || episodeState === 'needs-manual') {
      failed++
    }
  }
  return { ready, total: resolvedEpisodes.size, failed }
}
