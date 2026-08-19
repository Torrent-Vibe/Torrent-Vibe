import type {
  HelperEpisodeState,
  HelperReplica,
} from '@torrent-vibe/helper-protocol'
import { beforeEach, describe, expect, it } from 'vitest'

import { useHelperBindingsStore } from '../helper-client'
import type { HelperSyncClient } from './actions'
import { createSubscriptionActions } from './actions'
import { episodeStateForDisplay } from './selectors'
import { subscriptionStore } from './store'
import {
  conflictError,
  createFakeHelper,
  createMemoryPersist,
  emptyStatus,
  episode,
  stamp,
  subscribeInput,
} from './test-fakes'

describe('subscribe orchestration', () => {
  beforeEach(() => {
    subscriptionStore.reset()
    useHelperBindingsStore.setState({ bindings: {} })
    localStorage.clear()
  })

  it('puts every target, then backfills every target, then refreshes status', async () => {
    const calls: string[] = []
    const helper = createFakeHelper({ calls })
    const actions = createSubscriptionActions({
      persist: createMemoryPersist(),
      helper,
      now: () => stamp,
      id: () => 'sub-1',
      backfill: async (input) => {
        calls.push(`backfill:${input.serverId}`)
      },
      loadHelperStatus: async (serverId) => {
        calls.push(`status:${serverId}`)
        return { jobs: [], replicas: [] }
      },
    })

    const result = await actions.subscribe({
      ...subscribeInput,
      targetServerIds: ['srv-a', 'srv-b'],
      episodes: [episode('e1'), episode('e2')],
    })

    expect(result.ok).toBe(true)
    expect(calls).toEqual([
      'get:srv-a',
      'put:srv-a',
      'get:srv-b',
      'put:srv-b',
      'backfill:srv-a',
      'backfill:srv-b',
      'status:srv-a',
      'status:srv-b',
    ])
  })

  it('feeds every target the caller-supplied episode list', async () => {
    const backfilled: Array<{ episodeIds: string[]; serverId: string }> = []
    const actions = createSubscriptionActions({
      persist: createMemoryPersist(),
      helper: createFakeHelper(),
      now: () => stamp,
      id: () => 'sub-1',
      backfill: async (input) => {
        backfilled.push({
          serverId: input.serverId,
          episodeIds: input.episodes.map((entry) => entry.episodeId),
        })
      },
      loadHelperStatus: emptyStatus,
    })

    await actions.subscribe({
      ...subscribeInput,
      targetServerIds: ['srv-a', 'srv-b'],
      episodes: [episode('e1'), episode('e2')],
    })

    expect(backfilled).toEqual([
      { serverId: 'srv-a', episodeIds: ['e1', 'e2'] },
      { serverId: 'srv-b', episodeIds: ['e1', 'e2'] },
    ])
  })

  it('fans a standalone backfill out over every target of the subscription', async () => {
    const backfilled: string[] = []
    const actions = createSubscriptionActions({
      persist: createMemoryPersist(),
      helper: createFakeHelper(),
      now: () => stamp,
      id: () => 'sub-1',
      backfill: async (input) => {
        backfilled.push(input.serverId)
      },
      loadHelperStatus: emptyStatus,
    })

    await actions.subscribe({
      ...subscribeInput,
      targetServerIds: ['srv-a', 'srv-b'],
    })
    expect(backfilled).toEqual([])

    const result = await actions.backfill({
      bangumiId: 'bgm-1',
      subgroupId: 'sg-1',
      episodes: [episode('e1')],
    })

    expect(result.ok).toBe(true)
    expect(backfilled).toEqual(['srv-a', 'srv-b'])
  })

  it('keeps the subscription and warns when a backfill rejects', async () => {
    const persist = createMemoryPersist()
    const actions = createSubscriptionActions({
      persist,
      helper: createFakeHelper(),
      now: () => stamp,
      id: () => 'sub-1',
      backfill: async () => {
        throw new Error('backfill exploded')
      },
      loadHelperStatus: emptyStatus,
    })

    const result = await actions.subscribe({
      ...subscribeInput,
      targetServerIds: ['srv-a'],
      episodes: [episode('e1')],
    })

    expect(result.ok).toBe(true)
    expect(result.warning).toBe('backfillFailed')
    expect(subscriptionStore.getState().items.map((item) => item.id)).toEqual([
      'sub-1',
    ])
    expect(persist.snapshot().items.map((item) => item.id)).toEqual(['sub-1'])
    expect(subscriptionStore.getState().optimistic).toEqual({})
  })

  it('rolls back the optimistic write when the put fails', async () => {
    const inFlight: Array<Record<string, unknown>> = []
    const helper = createFakeHelper({ fail: new Set(['srv-a']) })
    const putSubscriptions = helper.putSubscriptions.bind(helper)
    helper.putSubscriptions = async (...args) => {
      inFlight.push(structuredClone(subscriptionStore.getState().optimistic))
      return putSubscriptions(...args)
    }
    const actions = createSubscriptionActions({
      persist: createMemoryPersist(),
      helper,
      now: () => stamp,
      id: () => 'sub-1',
      backfill: async () => {
        throw new Error('backfill must not run')
      },
      loadHelperStatus: emptyStatus,
    })

    const result = await actions.subscribe({
      ...subscribeInput,
      targetServerIds: ['srv-a'],
      episodes: [episode('e1')],
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('partialSync')
    expect(inFlight[0]).toMatchObject({
      'bgm-1::sg-1': { type: 'subscribe', startedAt: stamp },
    })
    expect(subscriptionStore.getState().optimistic).toEqual({})
  })

  it('merges the returned revision and gives up after three conflicted puts', async () => {
    const calls: string[] = []
    const sent: HelperReplica[][] = []
    const other: HelperReplica = {
      id: 'sub-other',
      bangumiId: 'bgm-2',
      title: 'Kitauji',
      subgroupId: 'sg-9',
      subgroupName: 'Nekomoe',
      rssUrl: 'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-2&subgroupid=sg-9',
    }
    let replicas: HelperReplica[] = []
    let revision = 0
    const helper: HelperSyncClient = {
      async getSubscriptions(serverId) {
        calls.push(`get:${serverId}`)
        return { replicas: structuredClone(replicas), revision }
      },
      async putSubscriptions(serverId, next) {
        calls.push(`put:${serverId}`)
        sent.push(structuredClone(next))
        replicas = [other]
        revision += 1
        throw conflictError(revision)
      },
    }
    const actions = createSubscriptionActions({
      persist: createMemoryPersist(),
      helper,
      now: () => stamp,
      id: () => 'sub-1',
      backfill: async () => {
        throw new Error('backfill must not run')
      },
      loadHelperStatus: emptyStatus,
    })

    const result = await actions.subscribe({
      ...subscribeInput,
      targetServerIds: ['srv-a'],
      episodes: [episode('e1')],
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('partialSync')
    expect(calls.filter((entry) => entry.startsWith('put:'))).toHaveLength(3)
    expect(sent[0]?.map((replica) => replica.id)).toEqual(['sub-1'])
    expect(sent[2]?.map((replica) => replica.id)).toEqual([
      'sub-other',
      'sub-1',
    ])
    expect(
      subscriptionStore.getState().items[0]?.syncByServer['srv-a'],
    ).toMatchObject({ status: 'error', lastError: 'revisionConflict' })
  })
  it('fills optimistic episode state only where no real state exists', async () => {
    const seen: Array<HelperEpisodeState | null> = []
    const actions = createSubscriptionActions({
      persist: createMemoryPersist(),
      helper: createFakeHelper(),
      now: () => stamp,
      id: () => 'sub-1',
      backfill: async () => {
        const state = subscriptionStore.getState()
        seen.push(
          episodeStateForDisplay(['srv-a'], 'bgm-1', 'sg-1', 'e1', state),
          episodeStateForDisplay(['srv-a'], 'bgm-1', 'sg-1', 'e2', state),
          episodeStateForDisplay(['srv-a'], 'bgm-1', 'sg-1', 'e3', state),
        )
      },
      loadHelperStatus: emptyStatus,
    })

    subscriptionStore.setState((draft) => {
      draft.statusByServer['srv-a'] = {
        fetchedAt: stamp,
        jobs: [],
        replicas: [
          {
            id: 'sub-1',
            bangumiId: 'bgm-1',
            title: 'Frieren',
            subgroupId: 'sg-1',
            subgroupName: 'ANi',
            rssUrl: subscribeInput.rssUrl,
            episodes: [
              {
                episodeId: 'e1',
                title: 'Frieren - e1',
                season: null,
                episode: null,
                state: 'skipped',
              },
            ],
          },
        ],
      }
    })

    await actions.subscribe({
      ...subscribeInput,
      targetServerIds: ['srv-a'],
      episodes: [episode('e1'), episode('e2')],
    })

    expect(seen).toEqual(['skipped', 'pending', null])
    expect(subscriptionStore.getState().optimistic).toEqual({})
  })
})
