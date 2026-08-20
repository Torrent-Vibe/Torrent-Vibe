import type { SubscriptionRecord } from '@torrent-vibe/helper-protocol'
import { describe, expect, it } from 'vitest'

import type {
  HelperEpisodeStatus,
  HelperReplicaStatus,
} from '~/modules/helper-client'
import type {
  HelperStatusSnapshot,
  SubscriptionsState,
} from '~/modules/subscriptions/store'

import { buildSubscriptionBadgeModel } from './subscription-badge-model'

const stamp = '2026-08-15T00:00:00.000Z'

function record(
  partial: Pick<SubscriptionRecord, 'id' | 'targetServerIds'> &
    Partial<SubscriptionRecord>,
): SubscriptionRecord {
  return {
    providerId: 'mikan',
    bangumiId: 'bgm-1',
    title: 'Frieren',
    subgroupId: 'sg-1',
    subgroupName: 'ANi',
    rssUrl: 'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-1&subgroupid=sg-1',
    syncByServer: {},
    createdAt: stamp,
    updatedAt: stamp,
    ...partial,
  }
}

function episode(
  partial: Pick<HelperEpisodeStatus, 'episodeId' | 'title'> &
    Partial<HelperEpisodeStatus>,
): HelperEpisodeStatus {
  return {
    season: 1,
    episode: 1,
    state: 'done',
    ...partial,
  }
}

function replica(
  partial: Pick<HelperReplicaStatus, 'id' | 'episodes'> &
    Partial<HelperReplicaStatus>,
): HelperReplicaStatus {
  return {
    bangumiId: 'bgm-1',
    title: 'Frieren',
    subgroupId: 'sg-1',
    subgroupName: 'ANi',
    rssUrl: 'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-1&subgroupid=sg-1',
    ...partial,
  }
}

function snapshot(
  partial: Partial<HelperStatusSnapshot> = {},
): HelperStatusSnapshot {
  return {
    fetchedAt: stamp,
    replicas: [],
    jobs: [],
    ...partial,
  }
}

function state(partial: Partial<SubscriptionsState> = {}): SubscriptionsState {
  return {
    items: [],
    optimistic: {},
    statusByServer: {},
    capabilitiesByServer: {},
    syncing: false,
    ...partial,
  }
}

describe('buildSubscriptionBadgeModel', () => {
  it('is neutral with count 0 when there are no subscriptions', () => {
    expect(buildSubscriptionBadgeModel(state())).toEqual({
      tone: 'neutral',
      count: 0,
    })
  })

  it('is neutral when every subscription is healthy', () => {
    const item = record({ id: 'sub-1', targetServerIds: ['srv-a'] })
    const result = buildSubscriptionBadgeModel(
      state({
        items: [item],
        statusByServer: {
          'srv-a': snapshot({
            replicas: [
              replica({
                id: 'sub-1',
                episodes: [
                  episode({ episodeId: 'e1', title: 'E1', state: 'done' }),
                ],
              }),
            ],
          }),
        },
      }),
    )
    expect(result).toEqual({ tone: 'neutral', count: 1 })
  })

  it('turns destructive when any subscription has a failed episode', () => {
    const healthy = record({ id: 'sub-1', targetServerIds: ['srv-a'] })
    const failing = record({
      id: 'sub-2',
      bangumiId: 'bgm-2',
      subgroupId: 'sg-2',
      targetServerIds: ['srv-a'],
    })
    const result = buildSubscriptionBadgeModel(
      state({
        items: [healthy, failing],
        statusByServer: {
          'srv-a': snapshot({
            replicas: [
              replica({
                id: 'sub-1',
                episodes: [
                  episode({ episodeId: 'e1', title: 'E1', state: 'done' }),
                ],
              }),
              replica({
                id: 'sub-2',
                bangumiId: 'bgm-2',
                subgroupId: 'sg-2',
                episodes: [
                  episode({ episodeId: 'e2', title: 'E2', state: 'failed' }),
                ],
              }),
            ],
          }),
        },
      }),
    )
    expect(result).toEqual({ tone: 'destructive', count: 2 })
  })

  it('turns destructive when any subscription has a needs-manual episode', () => {
    const item = record({ id: 'sub-1', targetServerIds: ['srv-a'] })
    const result = buildSubscriptionBadgeModel(
      state({
        items: [item],
        statusByServer: {
          'srv-a': snapshot({
            replicas: [
              replica({
                id: 'sub-1',
                episodes: [
                  episode({
                    episodeId: 'e1',
                    title: 'E1',
                    state: 'needs-manual',
                  }),
                ],
              }),
            ],
          }),
        },
      }),
    )
    expect(result).toEqual({ tone: 'destructive', count: 1 })
  })

  it('turns destructive on a checkError even when no episode has failed', () => {
    const item = record({ id: 'sub-1', targetServerIds: ['srv-a'] })
    const result = buildSubscriptionBadgeModel(
      state({
        items: [item],
        statusByServer: {
          'srv-a': snapshot({
            replicas: [
              replica({
                id: 'sub-1',
                episodes: [
                  episode({ episodeId: 'e1', title: 'E1', state: 'done' }),
                ],
                checkError: 'RSS unreachable',
                consecutiveFailures: 3,
              }),
            ],
          }),
        },
      }),
    )
    expect(result).toEqual({ tone: 'destructive', count: 1 })
  })

  it('keeps the count identical between a neutral and a destructive state over the same subscriptions', () => {
    const items = [
      record({ id: 'sub-1', targetServerIds: ['srv-a'] }),
      record({
        id: 'sub-2',
        bangumiId: 'bgm-2',
        subgroupId: 'sg-2',
        targetServerIds: ['srv-a'],
      }),
    ]

    const healthy = buildSubscriptionBadgeModel(
      state({
        items,
        statusByServer: {
          'srv-a': snapshot({
            replicas: [
              replica({ id: 'sub-1', episodes: [] }),
              replica({
                id: 'sub-2',
                bangumiId: 'bgm-2',
                subgroupId: 'sg-2',
                episodes: [],
              }),
            ],
          }),
        },
      }),
    )

    const destructive = buildSubscriptionBadgeModel(
      state({
        items,
        statusByServer: {
          'srv-a': snapshot({
            replicas: [
              replica({ id: 'sub-1', episodes: [] }),
              replica({
                id: 'sub-2',
                bangumiId: 'bgm-2',
                subgroupId: 'sg-2',
                episodes: [
                  episode({ episodeId: 'e2', title: 'E2', state: 'failed' }),
                ],
              }),
            ],
          }),
        },
      }),
    )

    expect(healthy.tone).toBe('neutral')
    expect(destructive.tone).toBe('destructive')
    expect(healthy.count).toBe(2)
    expect(destructive.count).toBe(2)
  })
})
