import type {
  HelperReplica,
  SubscriptionRecord,
} from '@torrent-vibe/helper-protocol'
import { describe, expect, it } from 'vitest'

import { desiredReplicasForServer, mergeDesiredReplicas } from './desired-set'

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

describe('desiredReplicasForServer', () => {
  it('returns an empty set when nothing targets the helper', () => {
    expect(desiredReplicasForServer([], 'srv-a')).toEqual([])
    expect(
      desiredReplicasForServer(
        [record({ id: 'sub-1', targetServerIds: ['srv-b'] })],
        'srv-a',
      ),
    ).toEqual([])
  })

  it('maps only subscriptions that target the helper', () => {
    const a = record({
      id: 'sub-a',
      targetServerIds: ['srv-a'],
      bangumiSubjectId: '123',
    })
    const b = record({
      id: 'sub-b',
      bangumiId: 'bgm-2',
      title: 'Bocchi',
      subgroupId: 'sg-2',
      subgroupName: 'Kitauji',
      rssUrl: 'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-2&subgroupid=sg-2',
      targetServerIds: ['srv-b', 'srv-a'],
    })
    const c = record({
      id: 'sub-c',
      bangumiId: 'bgm-3',
      title: 'Other',
      targetServerIds: ['srv-c'],
    })

    expect(desiredReplicasForServer([a, b, c], 'srv-a')).toEqual([
      {
        id: 'sub-a',
        bangumiId: 'bgm-1',
        title: 'Frieren',
        bangumiSubjectId: '123',
        subgroupId: 'sg-1',
        subgroupName: 'ANi',
        rssUrl: a.rssUrl,
      },
      {
        id: 'sub-b',
        bangumiId: 'bgm-2',
        title: 'Bocchi',
        subgroupId: 'sg-2',
        subgroupName: 'Kitauji',
        rssUrl: b.rssUrl,
      },
    ])
  })

  it('omits bangumiSubjectId when it is missing', () => {
    const item = record({ id: 'sub-1', targetServerIds: ['srv-a'] })
    expect(desiredReplicasForServer([item], 'srv-a')[0]).toEqual({
      id: 'sub-1',
      bangumiId: 'bgm-1',
      title: 'Frieren',
      subgroupId: 'sg-1',
      subgroupName: 'ANi',
      rssUrl: item.rssUrl,
    })
  })
})

describe('mergeDesiredReplicas', () => {
  const replica = (partial: Partial<HelperReplica> = {}): HelperReplica => ({
    id: 'sub-1',
    bangumiId: 'bgm-1',
    title: 'Frieren',
    subgroupId: 'sg-1',
    subgroupName: 'ANi',
    rssUrl: 'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-1&subgroupid=sg-1',
    ...partial,
  })

  it('adopts the id the helper already gave the same bangumi and subgroup', () => {
    const remote = replica({ id: 'ios-1', title: 'stale' })
    expect(
      mergeDesiredReplicas({
        base: [remote],
        desired: [replica()],
        remote: [remote],
      }),
    ).toEqual([replica({ id: 'ios-1' })])
  })

  it('keeps replicas that appeared after the conflicting revision', () => {
    const other = replica({
      id: 'sub-other',
      bangumiId: 'bgm-2',
      subgroupId: 'sg-2',
      title: 'Bocchi',
    })
    expect(
      mergeDesiredReplicas({
        base: [],
        desired: [replica()],
        remote: [other],
      }),
    ).toEqual([other, replica()])
  })

  it('still drops a replica the local set removed', () => {
    const other = replica({
      id: 'sub-other',
      bangumiId: 'bgm-2',
      subgroupId: 'sg-2',
      title: 'Bocchi',
    })
    expect(
      mergeDesiredReplicas({
        base: [replica()],
        desired: [],
        remote: [replica(), other],
      }),
    ).toEqual([other])
  })
})
