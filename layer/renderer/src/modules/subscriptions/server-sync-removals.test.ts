import type { HelperReplica } from '@torrent-vibe/helper-protocol'
import { beforeEach, describe, expect, it } from 'vitest'

import { useHelperBindingsStore } from '../helper-client'
import { createSubscriptionActions } from './actions'
import { subscriptionStore } from './store'
import {
  createFakeHelper,
  createMemoryPersist,
  emptyStatus,
  stamp,
  subscribeInput,
} from './test-fakes'

const remoteReplica = (
  bangumiId: string,
  subgroupId: string,
): HelperReplica => ({
  id: `${bangumiId}-${subgroupId}`,
  bangumiId,
  title: `Remote ${bangumiId}`,
  subgroupId,
  subgroupName: 'Remote Group',
  rssUrl: `https://mikanani.me/RSS/Bangumi?bangumiId=${bangumiId}&subgroupid=${subgroupId}`,
})

const identities = (replicas: HelperReplica[]) =>
  replicas
    .map((replica) => `${replica.bangumiId}::${replica.subgroupId}`)
    .sort()

describe('server sync never deletes replicas the client did not intend to remove', () => {
  beforeEach(() => {
    subscriptionStore.reset()
    useHelperBindingsStore.setState({ bindings: {} })
    localStorage.clear()
  })

  it('does not wipe a populated Helper when the local store is empty', async () => {
    const helper = createFakeHelper({
      current: {
        'srv-a': [
          remoteReplica('bgm-9', 'sg-9'),
          remoteReplica('bgm-8', 'sg-8'),
        ],
      },
    })
    const actions = createSubscriptionActions({
      persist: createMemoryPersist(),
      helper,
      now: () => stamp,
      loadHelperStatus: emptyStatus,
    })

    await actions.syncServers(['srv-a'])

    const wiped = helper.puts.find(
      (put) => put.serverId === 'srv-a' && put.replicas.length === 0,
    )
    expect(wiped).toBeUndefined()
    const snapshot = await helper.getSubscriptions('srv-a')
    expect(identities(snapshot.replicas)).toEqual([
      'bgm-8::sg-8',
      'bgm-9::sg-9',
    ])
  })

  it('keeps unknown remote replicas when subscribing to a new bangumi', async () => {
    const helper = createFakeHelper({
      current: { 'srv-a': [remoteReplica('bgm-9', 'sg-9')] },
    })
    const actions = createSubscriptionActions({
      persist: createMemoryPersist(),
      helper,
      now: () => stamp,
      id: () => 'sub-1',
      loadHelperStatus: emptyStatus,
    })

    await actions.subscribe({ ...subscribeInput, targetServerIds: ['srv-a'] })

    const snapshot = await helper.getSubscriptions('srv-a')
    expect(identities(snapshot.replicas)).toEqual([
      'bgm-1::sg-1',
      'bgm-9::sg-9',
    ])
  })

  it('removes exactly the unsubscribed replica and nothing else', async () => {
    const persist = createMemoryPersist()
    const helper = createFakeHelper({
      current: { 'srv-a': [remoteReplica('bgm-9', 'sg-9')] },
    })
    const actions = createSubscriptionActions({
      persist,
      helper,
      now: () => stamp,
      id: () => 'sub-1',
      loadHelperStatus: emptyStatus,
    })

    await actions.subscribe({ ...subscribeInput, targetServerIds: ['srv-a'] })
    await actions.unsubscribe('sub-1')

    const snapshot = await helper.getSubscriptions('srv-a')
    expect(identities(snapshot.replicas)).toEqual(['bgm-9::sg-9'])
  })

  it('drops a retargeted replica only from the server it left', async () => {
    const helper = createFakeHelper({
      current: {
        'srv-a': [remoteReplica('bgm-9', 'sg-9')],
        'srv-b': [remoteReplica('bgm-7', 'sg-7')],
      },
    })
    const actions = createSubscriptionActions({
      persist: createMemoryPersist(),
      helper,
      now: () => stamp,
      id: () => 'sub-1',
      loadHelperStatus: emptyStatus,
    })

    await actions.subscribe({
      ...subscribeInput,
      targetServerIds: ['srv-a', 'srv-b'],
    })
    await actions.retarget('sub-1', ['srv-a'])

    const a = await helper.getSubscriptions('srv-a')
    const b = await helper.getSubscriptions('srv-b')
    expect(identities(a.replicas)).toEqual(['bgm-1::sg-1', 'bgm-9::sg-9'])
    expect(identities(b.replicas)).toEqual(['bgm-7::sg-7'])
  })
})
