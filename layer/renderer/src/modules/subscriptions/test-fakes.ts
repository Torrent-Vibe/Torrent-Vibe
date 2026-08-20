import type { HelperReplica } from '@torrent-vibe/helper-protocol'
import type { RssEpisode } from '@torrent-vibe/mikan'

import type { HelperStatusResponse } from '../helper-client'
import type { HelperSyncClient, SubscriptionPushOptions } from './actions'
import type { PersistedSubscriptions } from './persist'

export const stamp = '2026-08-15T12:00:00.000Z'

export function createMemoryPersist(
  initial: PersistedSubscriptions = { items: [] },
) {
  let data = structuredClone(initial)
  return {
    load: () => structuredClone(data),
    save: (next: PersistedSubscriptions) => {
      data = structuredClone(next)
    },
    snapshot: () => structuredClone(data),
  }
}

export function createFakeHelper(options?: {
  calls?: string[]
  current?: Record<string, HelperReplica[]>
  fail?: Set<string>
}): HelperSyncClient & {
  puts: Array<{
    options?: SubscriptionPushOptions
    replicas: HelperReplica[]
    serverId: string
  }>
} {
  const current = { ...options?.current }
  const revisions: Record<string, number> = {}
  const fail = options?.fail ?? new Set<string>()
  const calls = options?.calls
  const puts: Array<{
    options?: SubscriptionPushOptions
    replicas: HelperReplica[]
    serverId: string
  }> = []
  return {
    puts,
    async getSubscriptions(serverId) {
      calls?.push(`get:${serverId}`)
      if (fail.has(`get:${serverId}`)) {
        throw new Error(`get failed ${serverId}`)
      }
      return {
        replicas: current[serverId] ?? [],
        revision: revisions[serverId] ?? 0,
      }
    },
    async putSubscriptions(serverId, replicas, expectedRevision, putOptions) {
      calls?.push(`put:${serverId}`)
      if (fail.has(serverId)) {
        throw new Error(`put failed ${serverId}`)
      }
      if ((revisions[serverId] ?? 0) !== expectedRevision) {
        throw new Error(`revision conflict ${serverId}`)
      }
      puts.push({
        serverId,
        replicas: structuredClone(replicas),
        options: putOptions,
      })
      current[serverId] = structuredClone(replicas)
      revisions[serverId] = expectedRevision + 1
    },
  }
}

export const subscribeInput = {
  bangumiId: 'bgm-1',
  title: 'Frieren',
  subgroupId: 'sg-1',
  subgroupName: 'ANi',
  rssUrl: 'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-1&subgroupid=sg-1',
}

export const episode = (episodeId: string): RssEpisode => ({
  episodeId,
  title: `Frieren - ${episodeId}`,
  torrentUrl: `https://mikanani.me/Download/${episodeId}.torrent`,
})

export const conflictError = (revision: number) =>
  Object.assign(new Error('helper 409'), {
    status: 409,
    body: { error: 'revision conflict', revision },
  })

export const emptyStatus = async (): Promise<HelperStatusResponse> => ({
  jobs: [],
  replicas: [],
})
