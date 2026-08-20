import type { SubscriptionRecord } from '@torrent-vibe/helper-protocol'
import { describe, expect, it } from 'vitest'

import type { HelperEpisodeStatus } from '~/modules/helper-client'
import type { HelperStatusSnapshot } from '~/modules/subscriptions/store'

import {
  lastRenameDisplay,
  latestEpisodeForSubscription,
} from './subscription-view'

const stamp = '2026-08-15T00:00:00.000Z'

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

function snapshot(
  episodes: HelperEpisodeStatus[],
): Record<string, HelperStatusSnapshot> {
  return {
    'srv-a': {
      fetchedAt: stamp,
      replicas: [
        {
          id: 'sub-1',
          bangumiId: 'bgm-1',
          title: 'Frieren',
          subgroupId: 'sg-1',
          subgroupName: 'ANi',
          rssUrl: 'https://mikanani.me/RSS/Bangumi',
          episodes,
        },
      ],
      jobs: [],
    },
  }
}

const item: SubscriptionRecord = {
  id: 'sub-1',
  providerId: 'mikan',
  bangumiId: 'bgm-1',
  title: 'Frieren',
  subgroupId: 'sg-1',
  subgroupName: 'ANi',
  rssUrl: 'https://mikanani.me/RSS/Bangumi',
  targetServerIds: ['srv-a'],
  syncByServer: {},
  createdAt: stamp,
  updatedAt: stamp,
}

describe('latestEpisodeForSubscription', () => {
  it('prefers the highest episode number over helper activity', () => {
    const latest = latestEpisodeForSubscription(
      item,
      snapshot([
        episode({
          episodeId: 'e1',
          title: 'Frieren - S01E01',
          episode: 1,
          state: 'done',
        }),
        episode({
          episodeId: 'e12',
          title: 'Frieren - S01E12',
          episode: 12,
          state: 'downloading',
        }),
      ]),
    )
    expect(latest?.episodeId).toBe('e12')
  })

  it('prefers a later season when episode numbers collide', () => {
    const latest = latestEpisodeForSubscription(
      item,
      snapshot([
        episode({
          episodeId: 's1e12',
          title: 'Frieren - S01E12',
          season: 1,
          episode: 12,
        }),
        episode({
          episodeId: 's2e01',
          title: 'Frieren - S02E01',
          season: 2,
          episode: 1,
        }),
      ]),
    )
    expect(latest?.episodeId).toBe('s2e01')
  })

  it('falls back to title recency when episode numbers are missing', () => {
    const latest = latestEpisodeForSubscription(
      item,
      snapshot([
        episode({
          episodeId: 'a',
          title: 'Frieren - 01',
          season: null,
          episode: null,
        }),
        episode({
          episodeId: 'b',
          title: 'Frieren - 12',
          season: null,
          episode: null,
        }),
      ]),
    )
    expect(latest?.episodeId).toBe('b')
  })
})

describe('lastRenameDisplay', () => {
  it('prefers lastError over the enum', () => {
    expect(
      lastRenameDisplay(
        episode({
          episodeId: 'e1',
          title: 'Frieren - S01E01',
          state: 'failed',
          lastError: 'rename denied',
        }),
      ),
    ).toEqual({ text: 'rename denied' })
  })

  it('returns a localized state key for rename outcomes', () => {
    expect(
      lastRenameDisplay(
        episode({
          episodeId: 'e1',
          title: 'Frieren - S01E01',
          state: 'needs-manual',
        }),
      ),
    ).toEqual({ key: 'discover.modal.mikan.episodeState.needsManual' })
    expect(
      lastRenameDisplay(
        episode({
          episodeId: 'e1',
          title: 'Frieren - S01E01',
          state: 'done',
        }),
      ),
    ).toEqual({ key: 'discover.modal.mikan.episodeState.done' })
  })
})
