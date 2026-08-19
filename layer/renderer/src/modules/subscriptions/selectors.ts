import type {
  HelperEpisodeState,
  SubscriptionRecord,
} from '@torrent-vibe/helper-protocol'

import type { HelperReplicaStatus } from '~/modules/helper-client'

import type { HelperStatusSnapshot, SubscriptionsState } from './store'
import { optimisticSubscriptionKey } from './store'

export type SubscriptionSource = 'cache' | 'helper' | 'optimistic'

export interface SubscriptionTargetHealth {
  checkedAt?: string
  checkError?: string
  consecutiveFailures?: number
  serverId: string
}

export interface ResolvedSubscription {
  record: SubscriptionRecord
  source: SubscriptionSource
  targets: SubscriptionTargetHealth[]
}

const findReplica = (
  bangumiId: string,
  subgroupId: string,
  serverId: string,
  statusByServer: Record<string, HelperStatusSnapshot>,
): HelperReplicaStatus | null =>
  statusByServer[serverId]?.replicas.find(
    (entry) => entry.bangumiId === bangumiId && entry.subgroupId === subgroupId,
  ) ?? null

const targetsFor = (
  record: SubscriptionRecord,
  statusByServer: Record<string, HelperStatusSnapshot>,
): SubscriptionTargetHealth[] => {
  const targets: SubscriptionTargetHealth[] = []
  for (const serverId of record.targetServerIds) {
    const replica = findReplica(
      record.bangumiId,
      record.subgroupId,
      serverId,
      statusByServer,
    )
    if (!replica) {
      continue
    }
    const target: SubscriptionTargetHealth = { serverId }
    if (replica.checkedAt !== undefined) {
      target.checkedAt = replica.checkedAt
    }
    if (replica.checkError !== undefined) {
      target.checkError = replica.checkError
    }
    if (replica.consecutiveFailures !== undefined) {
      target.consecutiveFailures = replica.consecutiveFailures
    }
    targets.push(target)
  }
  return targets
}

const synthesizeRecord = (
  replica: HelperReplicaStatus,
  serverId: string,
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
    targetServerIds: [serverId],
    syncByServer: {},
    createdAt: fetchedAt,
    updatedAt: fetchedAt,
  }
  if (replica.bangumiSubjectId !== undefined) {
    record.bangumiSubjectId = replica.bangumiSubjectId
  }
  return record
}

export const subscriptionFor = (
  bangumiId: string,
  subgroupId: string,
  state: SubscriptionsState,
): ResolvedSubscription | null => {
  const optimistic =
    state.optimistic[optimisticSubscriptionKey(bangumiId, subgroupId)]
  if (optimistic) {
    if (optimistic.type === 'remove') {
      return null
    }
    return {
      record: optimistic.record,
      source: 'optimistic',
      targets: targetsFor(optimistic.record, state.statusByServer),
    }
  }

  const cached =
    state.items.find(
      (item) => item.bangumiId === bangumiId && item.subgroupId === subgroupId,
    ) ?? null

  if (cached) {
    const targets = targetsFor(cached, state.statusByServer)
    return {
      record: cached,
      source: targets.length > 0 ? 'helper' : 'cache',
      targets,
    }
  }

  for (const [serverId, snapshot] of Object.entries(state.statusByServer)) {
    const replica = snapshot.replicas.find(
      (entry) =>
        entry.bangumiId === bangumiId && entry.subgroupId === subgroupId,
    )
    if (!replica) {
      continue
    }
    const record = synthesizeRecord(replica, serverId, snapshot.fetchedAt)
    return {
      record,
      source: 'helper',
      targets: targetsFor(record, state.statusByServer),
    }
  }

  return null
}

const EPISODE_STATE_RANK: Record<HelperEpisodeState, number> = {
  failed: 0,
  'needs-manual': 1,
  pending: 2,
  added: 3,
  downloading: 4,
  renaming: 5,
  skipped: 6,
  done: 7,
}

export const episodeStateFor = (
  targetServerIds: string[],
  bangumiId: string,
  subgroupId: string,
  episodeId: string,
  statusByServer: Record<string, HelperStatusSnapshot>,
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
    const replica = snapshot.replicas.find(
      (entry) =>
        entry.bangumiId === bangumiId && entry.subgroupId === subgroupId,
    )
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

export const subscriptionProgress = (
  record: SubscriptionRecord,
  state: SubscriptionsState,
): { failed: number; ready: number; total: number } => {
  const episodeIds = new Set<string>()
  for (const serverId of record.targetServerIds) {
    const replica = findReplica(
      record.bangumiId,
      record.subgroupId,
      serverId,
      state.statusByServer,
    )
    for (const episode of replica?.episodes ?? []) {
      episodeIds.add(episode.episodeId)
    }
  }

  let ready = 0
  let failed = 0
  for (const episodeId of episodeIds) {
    const resolved = episodeStateFor(
      record.targetServerIds,
      record.bangumiId,
      record.subgroupId,
      episodeId,
      state.statusByServer,
    )
    if (resolved === 'done') {
      ready += 1
    }
    if (resolved === 'failed' || resolved === 'needs-manual') {
      failed += 1
    }
  }

  return { failed, ready, total: episodeIds.size }
}
