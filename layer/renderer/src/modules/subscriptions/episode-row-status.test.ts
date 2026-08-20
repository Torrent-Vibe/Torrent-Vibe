import type { SubscriptionRecord } from '@torrent-vibe/helper-protocol'
import { describe, expect, it } from 'vitest'

import { episodeRowStatusFor } from './selectors'
import type { SubscriptionsState } from './store'

const stamp = '2026-08-20T00:00:00.000Z'

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

function emptyState(): SubscriptionsState {
  return {
    items: [],
    optimistic: {},
    statusByServer: {},
    capabilitiesByServer: {},
    syncing: false,
  }
}

describe('episodeRowStatusFor', () => {
  it('falls back to the optimistic pending state during the subscribe round-trip', () => {
    const state = emptyState()
    state.optimistic['bgm-1::sg-1'] = {
      type: 'subscribe',
      startedAt: stamp,
      record: record({ id: 'sub-1', targetServerIds: ['srv-a'] }),
      episodeIds: ['e1', 'e2'],
    }

    expect(
      episodeRowStatusFor(['srv-a'], 'bgm-1', 'sg-1', 'e1', state),
    ).toEqual({ infohash: undefined, state: 'pending' })
  })

  it('does not fabricate a pending state for an episode outside the optimistic write', () => {
    const state = emptyState()
    state.optimistic['bgm-1::sg-1'] = {
      type: 'subscribe',
      startedAt: stamp,
      record: record({ id: 'sub-1', targetServerIds: ['srv-a'] }),
      episodeIds: ['e1'],
    }

    expect(
      episodeRowStatusFor(['srv-a'], 'bgm-1', 'sg-1', 'e2', state),
    ).toEqual({ infohash: undefined, state: null })
  })

  it('prefers the real reported status (with infohash) over an optimistic pending guess', () => {
    const state = emptyState()
    state.optimistic['bgm-1::sg-1'] = {
      type: 'subscribe',
      startedAt: stamp,
      record: record({ id: 'sub-1', targetServerIds: ['srv-a'] }),
      episodeIds: ['e1'],
    }
    state.statusByServer['srv-a'] = {
      fetchedAt: stamp,
      jobs: [],
      replicas: [
        {
          id: 'sub-1',
          bangumiId: 'bgm-1',
          title: 'Frieren',
          subgroupId: 'sg-1',
          subgroupName: 'ANi',
          rssUrl:
            'https://mikanani.me/RSS/Bangumi?bangumiId=bgm-1&subgroupid=sg-1',
          episodes: [
            {
              episodeId: 'e1',
              title: 'Frieren - e1',
              season: null,
              episode: null,
              state: 'downloading',
              infohash: 'abc123',
            },
          ],
        },
      ],
    }

    expect(
      episodeRowStatusFor(['srv-a'], 'bgm-1', 'sg-1', 'e1', state),
    ).toEqual({ infohash: 'abc123', state: 'downloading' })
  })

  it('returns null state and undefined infohash when nothing is known about the episode', () => {
    const state = emptyState()

    expect(
      episodeRowStatusFor(['srv-a'], 'bgm-1', 'sg-1', 'e1', state),
    ).toEqual({ infohash: undefined, state: null })
  })
})
