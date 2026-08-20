import type { SubscriptionRecord } from '@torrent-vibe/helper-protocol'
import { describe, expect, it } from 'vitest'

import {
  findOtherSubscribedSubgroup,
  subscribedSubgroupIds,
} from './subgroup-subscription'

const record = (
  partial: Pick<SubscriptionRecord, 'bangumiId' | 'subgroupId'> &
    Partial<SubscriptionRecord>,
): SubscriptionRecord => ({
  id: `${partial.bangumiId}-${partial.subgroupId}`,
  providerId: 'mikan',
  title: 'Frieren',
  subgroupName: partial.subgroupId,
  rssUrl: 'https://mikanani.me/RSS/Bangumi',
  targetServerIds: ['srv-a'],
  syncByServer: {},
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:00.000Z',
  ...partial,
})

describe('subscribedSubgroupIds', () => {
  it('collects only the subgroup ids subscribed for the given bangumi', () => {
    const items = [
      record({ bangumiId: 'bgm-1', subgroupId: 'sg-1' }),
      record({ bangumiId: 'bgm-1', subgroupId: 'sg-2' }),
      record({ bangumiId: 'bgm-2', subgroupId: 'sg-3' }),
    ]
    expect(subscribedSubgroupIds(items, 'bgm-1')).toEqual(
      new Set(['sg-1', 'sg-2']),
    )
  })

  it('returns an empty set when the bangumi has no subscriptions', () => {
    const items = [record({ bangumiId: 'bgm-2', subgroupId: 'sg-3' })]
    expect(subscribedSubgroupIds(items, 'bgm-1')).toEqual(new Set())
  })
})

describe('findOtherSubscribedSubgroup', () => {
  it('finds another subscribed subgroup when the selected one is unsubscribed', () => {
    const items = [record({ bangumiId: 'bgm-1', subgroupId: 'sg-1' })]
    expect(findOtherSubscribedSubgroup(items, 'bgm-1', 'sg-2')).toEqual({
      subgroupId: 'sg-1',
      subgroupName: 'sg-1',
    })
  })

  it('does not fire when the selected subgroup is itself the subscribed one', () => {
    const items = [record({ bangumiId: 'bgm-1', subgroupId: 'sg-1' })]
    expect(findOtherSubscribedSubgroup(items, 'bgm-1', 'sg-1')).toBeNull()
  })

  it('returns null when no subgroup of the bangumi is subscribed', () => {
    const items = [record({ bangumiId: 'bgm-2', subgroupId: 'sg-3' })]
    expect(findOtherSubscribedSubgroup(items, 'bgm-1', 'sg-1')).toBeNull()
  })

  it('returns null when there is no selected subgroup and nothing is subscribed', () => {
    expect(findOtherSubscribedSubgroup([], 'bgm-1', null)).toBeNull()
  })
})
