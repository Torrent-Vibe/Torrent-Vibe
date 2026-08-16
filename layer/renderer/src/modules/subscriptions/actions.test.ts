import type { HelperReplica } from '@torrent-vibe/helper-protocol'
import { desiredStateDiff } from '@torrent-vibe/helper-protocol'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  getHelperBinding,
  setHelperBinding,
  useHelperBindingsStore,
} from '../helper-client'
import type { HelperSyncClient } from './actions'
import { createSubscriptionActions } from './actions'
import { desiredReplicasForServer } from './desired-set'
import type { PersistedSubscriptions } from './persist'
import { subscriptionStore } from './store'

const stamp = '2026-08-15T12:00:00.000Z'

function createMemoryPersist(initial: PersistedSubscriptions = { items: [] }) {
  let data = structuredClone(initial)
  return {
    load: () => structuredClone(data),
    save: (next: PersistedSubscriptions) => {
      data = structuredClone(next)
    },
    snapshot: () => structuredClone(data),
  }
}

function createFakeHelper(options?: {
  current?: Record<string, HelperReplica[]>
  fail?: Set<string>
}): HelperSyncClient & {
  puts: Array<{ serverId: string, replicas: HelperReplica[] }>
} {
  const current = { ...(options?.current ?? {}) }
  const fail = options?.fail ?? new Set<string>()
  const puts: Array<{ serverId: string, replicas: HelperReplica[] }> = []
  return {
    puts,
    async getSubscriptions(serverId) {
      if (fail.has(`get:${serverId}`)) {
        throw new Error(`get failed ${serverId}`)
      }
      return current[serverId] ?? []
    },
    async putSubscriptions(serverId, replicas) {
      if (fail.has(serverId)) {
        throw new Error(`put failed ${serverId}`)
      }
      puts.push({ serverId, replicas: structuredClone(replicas) })
      current[serverId] = structuredClone(replicas)
    },
  }
}

describe('subscription actions', () => {
  beforeEach(() => {
    subscriptionStore.reset()
    useHelperBindingsStore.setState({ bindings: {} })
    localStorage.clear()
  })

  it('subscribes, persists, and puts the per-helper desired set', async () => {
    const persist = createMemoryPersist()
    const helper = createFakeHelper()
    const actions = createSubscriptionActions({
      persist,
      helper,
      now: () => stamp,
      id: () => 'sub-1',
    })

    const result = await actions.subscribe({
      bangumiId: 'bgm-1',
      title: 'Frieren',
      coverUrl: 'https://example.com/frieren.jpg',
      bangumiSubjectId: '123',
      subgroupId: 'sg-1',
      subgroupName: 'ANi',
      rssUrl: 'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-1&subgroupid=sg-1',
      targetServerIds: ['srv-a', 'srv-b'],
    })

    expect(result.ok).toBe(true)
    expect(result.data?.id).toBe('sub-1')

    const items = subscriptionStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'sub-1',
      providerId: 'mikan',
      bangumiId: 'bgm-1',
      targetServerIds: ['srv-a', 'srv-b'],
      syncByServer: {
        'srv-a': { status: 'ok', lastPushedAt: stamp },
        'srv-b': { status: 'ok', lastPushedAt: stamp },
      },
    })
    expect(persist.snapshot().items).toEqual(items)
    expect(helper.puts).toHaveLength(2)
    expect(helper.puts[0]?.replicas).toEqual(
      desiredReplicasForServer(items, 'srv-a'),
    )
    expect(helper.puts[1]?.replicas).toEqual(
      desiredReplicasForServer(items, 'srv-b'),
    )
  })

  it('unsubscribes and pushes the remaining desired set', async () => {
    const persist = createMemoryPersist()
    const helper = createFakeHelper()
    const actions = createSubscriptionActions({
      persist,
      helper,
      now: () => stamp,
      id: () => 'keep',
    })

    await actions.subscribe({
      bangumiId: 'bgm-keep',
      title: 'Keep',
      subgroupId: 'sg-1',
      subgroupName: 'ANi',
      rssUrl:
        'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-keep&subgroupid=sg-1',
      targetServerIds: ['srv-a'],
    })

    const remove = createSubscriptionActions({
      persist,
      helper,
      now: () => stamp,
      id: () => 'drop',
    })
    await remove.subscribe({
      bangumiId: 'bgm-drop',
      title: 'Drop',
      subgroupId: 'sg-2',
      subgroupName: 'Kitauji',
      rssUrl:
        'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-drop&subgroupid=sg-2',
      targetServerIds: ['srv-a'],
    })

    helper.puts.length = 0
    const result = await remove.unsubscribe('drop')
    expect(result.ok).toBe(true)
    expect(subscriptionStore.getState().items.map(item => item.id)).toEqual([
      'keep',
    ])
    expect(helper.puts).toEqual([
      {
        serverId: 'srv-a',
        replicas: desiredReplicasForServer(
          subscriptionStore.getState().items,
          'srv-a',
        ),
      },
    ])
    expect(persist.snapshot().items.map(item => item.id)).toEqual(['keep'])
  })

  it('retargets by pushing every gained and lost helper', async () => {
    const persist = createMemoryPersist()
    const helper = createFakeHelper()
    const actions = createSubscriptionActions({
      persist,
      helper,
      now: () => stamp,
      id: () => 'sub-1',
    })

    await actions.subscribe({
      bangumiId: 'bgm-1',
      title: 'Frieren',
      subgroupId: 'sg-1',
      subgroupName: 'ANi',
      rssUrl: 'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-1&subgroupid=sg-1',
      targetServerIds: ['srv-a', 'srv-b'],
    })
    helper.puts.length = 0

    const result = await actions.retarget('sub-1', ['srv-b', 'srv-c'])
    expect(result.ok).toBe(true)

    const items = subscriptionStore.getState().items
    expect(items[0]?.targetServerIds).toEqual(['srv-b', 'srv-c'])
    const pushed = new Set(helper.puts.map(entry => entry.serverId))
    expect(pushed).toEqual(new Set(['srv-a', 'srv-c']))
    for (const entry of helper.puts) {
      expect(entry.replicas).toEqual(
        desiredReplicasForServer(items, entry.serverId),
      )
    }
    expect(items[0]?.syncByServer['srv-b']?.status).toBe('ok')
  })

  it('records a helper error without rolling back other helpers or local state', async () => {
    const persist = createMemoryPersist()
    const helper = createFakeHelper({ fail: new Set(['srv-b']) })
    const actions = createSubscriptionActions({
      persist,
      helper,
      now: () => stamp,
      id: () => 'sub-1',
    })

    const result = await actions.subscribe({
      bangumiId: 'bgm-1',
      title: 'Frieren',
      subgroupId: 'sg-1',
      subgroupName: 'ANi',
      rssUrl: 'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-1&subgroupid=sg-1',
      targetServerIds: ['srv-a', 'srv-b'],
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('partialSync')
    const item = subscriptionStore.getState().items[0]
    expect(item?.targetServerIds).toEqual(['srv-a', 'srv-b'])
    expect(item?.syncByServer['srv-a']?.status).toBe('ok')
    expect(item?.syncByServer['srv-b']).toMatchObject({
      status: 'error',
      lastError: 'put failed srv-b',
    })
    expect(helper.puts.map(entry => entry.serverId)).toEqual(['srv-a'])
    expect(persist.snapshot().items[0]?.syncByServer['srv-b']?.status).toBe(
      'error',
    )
  })

  it('skips put when desiredStateDiff is empty', async () => {
    const replica: HelperReplica = {
      id: 'sub-1',
      bangumiId: 'bgm-1',
      title: 'Frieren',
      subgroupId: 'sg-1',
      subgroupName: 'ANi',
      rssUrl: 'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-1&subgroupid=sg-1',
    }
    const persist = createMemoryPersist({
      items: [
        {
          ...replica,
          providerId: 'mikan',
          targetServerIds: ['srv-a'],
          syncByServer: {},
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
    })
    const helper = createFakeHelper({ current: { 'srv-a': [replica] } })
    const actions = createSubscriptionActions({
      persist,
      helper,
      now: () => stamp,
      id: () => 'unused',
    })
    actions.hydrate()

    const result = await actions.syncServers(['srv-a'])
    expect(result.ok).toBe(true)
    expect(helper.puts).toEqual([])
    expect(
      desiredStateDiff(
        desiredReplicasForServer(subscriptionStore.getState().items, 'srv-a'),
        [replica],
      ),
    ).toEqual([])
    expect(
      subscriptionStore.getState().items[0]?.syncByServer['srv-a']?.status,
    ).toBe('ok')
  })

  it('forgetServer clears the helper binding and strips that target', async () => {
    setHelperBinding('srv-a', { url: 'http://nas:17890', token: 'tok' })
    const persist = createMemoryPersist()
    const helper = createFakeHelper()
    const actions = createSubscriptionActions({
      persist,
      helper,
      now: () => stamp,
      id: () => 'sub-1',
    })

    await actions.subscribe({
      bangumiId: 'bgm-1',
      title: 'Frieren',
      subgroupId: 'sg-1',
      subgroupName: 'ANi',
      rssUrl: 'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-1&subgroupid=sg-1',
      targetServerIds: ['srv-a', 'srv-b'],
    })
    helper.puts.length = 0

    const result = await actions.forgetServer('srv-a')
    expect(result.ok).toBe(true)
    expect(getHelperBinding('srv-a')).toBeNull()
    expect(subscriptionStore.getState().items[0]?.targetServerIds).toEqual([
      'srv-b',
    ])
    expect(
      subscriptionStore.getState().items[0]?.syncByServer['srv-a'],
    ).toBeUndefined()
    expect(persist.snapshot().items[0]?.targetServerIds).toEqual(['srv-b'])
    expect(helper.puts).toEqual([])
  })

  it('forgetServer unsubscribes when no targets remain', async () => {
    setHelperBinding('srv-a', { url: 'http://nas:17890', token: 'tok' })
    const persist = createMemoryPersist()
    const helper = createFakeHelper()
    const actions = createSubscriptionActions({
      persist,
      helper,
      now: () => stamp,
      id: () => 'sub-1',
    })

    await actions.subscribe({
      bangumiId: 'bgm-1',
      title: 'Frieren',
      subgroupId: 'sg-1',
      subgroupName: 'ANi',
      rssUrl: 'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-1&subgroupid=sg-1',
      targetServerIds: ['srv-a'],
    })

    const result = await actions.forgetServer('srv-a')
    expect(result.ok).toBe(true)
    expect(getHelperBinding('srv-a')).toBeNull()
    expect(subscriptionStore.getState().items).toEqual([])
    expect(persist.snapshot().items).toEqual([])
  })

  it('unbindHelper unpairs and keeps subscription targets', async () => {
    setHelperBinding('srv-a', { url: 'http://nas:17890', token: 'tok' })
    const persist = createMemoryPersist()
    const helper = createFakeHelper()
    const unpaired: string[] = []
    const actions = createSubscriptionActions({
      persist,
      helper,
      now: () => stamp,
      id: () => 'sub-1',
      unpair: async (serverId) => {
        unpaired.push(serverId)
      },
    })
    await actions.subscribe({
      bangumiId: 'bgm-1',
      title: 'Frieren',
      subgroupId: 'sg-1',
      subgroupName: 'ANi',
      rssUrl: 'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-1&subgroupid=sg-1',
      targetServerIds: ['srv-a'],
    })
    const result = await actions.unbindHelper('srv-a')
    expect(result.ok).toBe(true)
    expect(unpaired).toEqual(['srv-a'])
    expect(getHelperBinding('srv-a')).toBeNull()
    expect(subscriptionStore.getState().items[0]?.targetServerIds).toEqual([
      'srv-a',
    ])
  })

  it('unbindHelper still clears a local binding when unpair fails', async () => {
    setHelperBinding('srv-a', { url: 'http://nas:17890', token: 'tok' })
    const actions = createSubscriptionActions({
      persist: createMemoryPersist(),
      helper: createFakeHelper(),
      now: () => stamp,
      id: () => 'sub-1',
      unpair: async () => {
        throw new Error('down')
      },
    })
    const result = await actions.unbindHelper('srv-a')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('unreachable')
    expect(getHelperBinding('srv-a')).toBeNull()
  })

  it('forgetServer unpairs then strips targets', async () => {
    setHelperBinding('srv-a', { url: 'http://nas:17890', token: 'tok' })
    const unpaired: string[] = []
    const persist = createMemoryPersist()
    const helper = createFakeHelper()
    const actions = createSubscriptionActions({
      persist,
      helper,
      now: () => stamp,
      id: () => 'sub-1',
      unpair: async (serverId) => {
        unpaired.push(serverId)
      },
    })
    await actions.subscribe({
      bangumiId: 'bgm-1',
      title: 'Frieren',
      subgroupId: 'sg-1',
      subgroupName: 'ANi',
      rssUrl: 'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-1&subgroupid=sg-1',
      targetServerIds: ['srv-a', 'srv-b'],
    })
    await actions.forgetServer('srv-a')
    expect(unpaired).toEqual(['srv-a'])
    expect(subscriptionStore.getState().items[0]?.targetServerIds).toEqual([
      'srv-b',
    ])
  })

  it('retryEpisode posts and refreshes', async () => {
    const retried: string[] = []
    const actions = createSubscriptionActions({
      persist: createMemoryPersist(),
      helper: createFakeHelper(),
      now: () => stamp,
      retry: async (input) => {
        retried.push(input.episodeId)
      },
    })
    const result = await actions.retryEpisode({
      serverId: 'srv-a',
      bangumiId: '3141',
      subgroupId: '583',
      episodeId: 'ep-1',
    })
    expect(result.ok).toBe(true)
    expect(retried).toEqual(['ep-1'])
  })
})
