import type {
  HelperEpisodeState,
  SubscriptionRecord,
} from '@torrent-vibe/helper-protocol'
import { describe, expect, it } from 'vitest'

import type { HelperEpisodeStatus, HelperReplicaStatus } from '../helper-client'
import {
  episodeStateFor,
  episodeStatusFor,
  subscriptionFor,
  subscriptionProgress,
} from './selectors'
import type { HelperStatusSnapshot, SubscriptionsState } from './store'

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

describe('subscriptionFor', () => {
  it('returns null when the subscription is not known anywhere', () => {
    expect(subscriptionFor('bgm-1', 'sg-1', state())).toBeNull()
  })

  it('prefers an in-flight optimistic write over helper and cache', () => {
    const cached = record({ id: 'cache-sub', targetServerIds: ['srv-a'] })
    const optimisticRecord = record({
      id: 'opt-sub',
      targetServerIds: ['srv-b'],
      title: 'Frieren (optimistic)',
    })
    const result = subscriptionFor(
      'bgm-1',
      'sg-1',
      state({
        items: [cached],
        statusByServer: {
          'srv-a': snapshot({
            replicas: [replica({ id: 'cache-sub', episodes: [] })],
          }),
        },
        optimistic: {
          'bgm-1::sg-1': {
            type: 'subscribe',
            record: optimisticRecord,
            startedAt: stamp,
          },
        },
      }),
    )
    expect(result?.source).toBe('optimistic')
    expect(result?.record.id).toBe('opt-sub')
  })

  it('treats an in-flight optimistic unsubscribe as absent', () => {
    const cached = record({ id: 'cache-sub', targetServerIds: ['srv-a'] })
    const result = subscriptionFor(
      'bgm-1',
      'sg-1',
      state({
        items: [cached],
        optimistic: {
          'bgm-1::sg-1': { type: 'unsubscribe', startedAt: stamp },
        },
      }),
    )
    expect(result).toBeNull()
  })

  it('prefers the helper snapshot over the local cache when both exist', () => {
    const cached = record({
      id: 'cache-sub',
      targetServerIds: ['srv-a'],
      title: 'Frieren (stale title)',
    })
    const result = subscriptionFor(
      'bgm-1',
      'sg-1',
      state({
        items: [cached],
        statusByServer: {
          'srv-a': snapshot({
            replicas: [replica({ id: 'cache-sub', episodes: [] })],
          }),
        },
      }),
    )
    expect(result?.source).toBe('helper')
    expect(result?.record.title).toBe('Frieren (stale title)')
  })

  it('discovers a helper-only subscription with no local cache record (fresh machine)', () => {
    const result = subscriptionFor(
      'bgm-1',
      'sg-1',
      state({
        statusByServer: {
          'srv-a': snapshot({
            fetchedAt: '2026-08-16T00:00:00.000Z',
            replicas: [
              replica({
                id: 'helper-sub',
                episodes: [],
                bangumiSubjectId: '999',
              }),
            ],
          }),
        },
      }),
    )
    expect(result?.source).toBe('helper')
    expect(result?.record.id).toBe('helper-sub')
    expect(result?.record.targetServerIds).toEqual(['srv-a'])
    expect(result?.record.bangumiSubjectId).toBe('999')
  })

  it('falls back to the local cache with source "cache" when the helper is unreachable', () => {
    const cached = record({ id: 'cache-sub', targetServerIds: ['srv-a'] })
    const result = subscriptionFor(
      'bgm-1',
      'sg-1',
      state({
        items: [cached],
        statusByServer: {
          'srv-a': snapshot({ error: 'network unreachable', replicas: [] }),
        },
      }),
    )
    expect(result?.source).toBe('cache')
    expect(result?.record.id).toBe('cache-sub')
  })

  it('keeps a never-checked replica distinguishable from a checked-and-healthy one', () => {
    const cached = record({
      id: 'cache-sub',
      targetServerIds: ['srv-never', 'srv-healthy'],
    })
    const result = subscriptionFor(
      'bgm-1',
      'sg-1',
      state({
        items: [cached],
        statusByServer: {
          'srv-never': snapshot({
            replicas: [replica({ id: 'cache-sub', episodes: [] })],
          }),
          'srv-healthy': snapshot({
            replicas: [
              replica({
                id: 'cache-sub',
                episodes: [],
                checkedAt: '2026-08-16T00:00:00.000Z',
              }),
            ],
          }),
        },
      }),
    )
    const never = result?.targets.find((t) => t.serverId === 'srv-never')
    const healthy = result?.targets.find((t) => t.serverId === 'srv-healthy')
    expect(never?.checkedAt).toBeUndefined()
    expect(healthy?.checkedAt).toBe('2026-08-16T00:00:00.000Z')
  })
})

describe('episodeStateFor', () => {
  it("considers only the subscription's own target servers", () => {
    const statusByServer: Record<string, HelperStatusSnapshot> = {
      'srv-a': snapshot({
        replicas: [
          replica({
            id: 'sub-1',
            episodes: [
              episode({ episodeId: 'e1', title: 'E1', state: 'downloading' }),
            ],
          }),
        ],
      }),
      'srv-other': snapshot({
        replicas: [
          replica({
            id: 'sub-1',
            episodes: [
              episode({ episodeId: 'e1', title: 'E1', state: 'failed' }),
            ],
          }),
        ],
      }),
    }
    expect(
      episodeStateFor(['srv-a'], 'bgm-1', 'sg-1', 'e1', statusByServer),
    ).toBe('downloading')
  })

  it('returns null when no target has the episode', () => {
    expect(episodeStateFor(['srv-a'], 'bgm-1', 'sg-1', 'e1', {})).toBeNull()
  })

  it('treats an episode absent on one target as contributing nothing', () => {
    const statusByServer: Record<string, HelperStatusSnapshot> = {
      'srv-a': snapshot({ replicas: [replica({ id: 'sub-1', episodes: [] })] }),
      'srv-b': snapshot({
        replicas: [
          replica({
            id: 'sub-1',
            episodes: [
              episode({ episodeId: 'e1', title: 'E1', state: 'downloading' }),
            ],
          }),
        ],
      }),
    }
    expect(
      episodeStateFor(
        ['srv-a', 'srv-b'],
        'bgm-1',
        'sg-1',
        'e1',
        statusByServer,
      ),
    ).toBe('downloading')
  })

  it('reads subscription-less jobs when no replica exists', () => {
    const statusByServer: Record<string, HelperStatusSnapshot> = {
      'srv-a': snapshot({
        jobs: [
          {
            bangumiId: 'bgm-1',
            subgroupId: 'sg-1',
            episodes: [
              episode({ episodeId: 'e12', title: 'E12', state: 'added' }),
            ],
          },
        ],
      }),
    }
    expect(
      episodeStateFor(['srv-a'], 'bgm-1', 'sg-1', 'e12', statusByServer),
    ).toBe('added')
  })

  const adjacentPairs: [HelperEpisodeState, HelperEpisodeState][] = [
    ['failed', 'needs-manual'],
    ['needs-manual', 'pending'],
    ['pending', 'added'],
    ['added', 'downloading'],
    ['downloading', 'renaming'],
    ['renaming', 'skipped'],
    ['skipped', 'done'],
  ]

  it.each(adjacentPairs)(
    'resolves %s over %s regardless of which target reports it',
    (lower, higher) => {
      const forward: Record<string, HelperStatusSnapshot> = {
        'srv-a': snapshot({
          replicas: [
            replica({
              id: 'sub-1',
              episodes: [
                episode({ episodeId: 'e1', title: 'E1', state: lower }),
              ],
            }),
          ],
        }),
        'srv-b': snapshot({
          replicas: [
            replica({
              id: 'sub-1',
              episodes: [
                episode({ episodeId: 'e1', title: 'E1', state: higher }),
              ],
            }),
          ],
        }),
      }
      expect(
        episodeStateFor(['srv-a', 'srv-b'], 'bgm-1', 'sg-1', 'e1', forward),
      ).toBe(lower)

      const reversed: Record<string, HelperStatusSnapshot> = {
        'srv-a': snapshot({
          replicas: [
            replica({
              id: 'sub-1',
              episodes: [
                episode({ episodeId: 'e1', title: 'E1', state: higher }),
              ],
            }),
          ],
        }),
        'srv-b': snapshot({
          replicas: [
            replica({
              id: 'sub-1',
              episodes: [
                episode({ episodeId: 'e1', title: 'E1', state: lower }),
              ],
            }),
          ],
        }),
      }
      expect(
        episodeStateFor(['srv-a', 'srv-b'], 'bgm-1', 'sg-1', 'e1', reversed),
      ).toBe(lower)
    },
  )
})

describe('episodeStatusFor', () => {
  it('returns the resolved episode including its infohash', () => {
    const statusByServer: Record<string, HelperStatusSnapshot> = {
      'srv-a': snapshot({
        replicas: [
          replica({
            id: 'sub-1',
            episodes: [
              episode({
                episodeId: 'e1',
                title: 'E1',
                state: 'downloading',
                infohash: 'ABC123',
              }),
            ],
          }),
        ],
      }),
    }
    expect(
      episodeStatusFor(['srv-a'], 'bgm-1', 'sg-1', 'e1', statusByServer),
    ).toEqual(
      expect.objectContaining({ state: 'downloading', infohash: 'ABC123' }),
    )
  })

  it('returns null when no target has the episode', () => {
    expect(episodeStatusFor(['srv-a'], 'bgm-1', 'sg-1', 'e1', {})).toBeNull()
  })

  it('agrees with episodeStateFor on which target wins by rank', () => {
    const statusByServer: Record<string, HelperStatusSnapshot> = {
      'srv-a': snapshot({
        replicas: [
          replica({
            id: 'sub-1',
            episodes: [
              episode({
                episodeId: 'e1',
                title: 'E1',
                state: 'done',
                infohash: 'done-hash',
              }),
            ],
          }),
        ],
      }),
      'srv-b': snapshot({
        replicas: [
          replica({
            id: 'sub-1',
            episodes: [
              episode({
                episodeId: 'e1',
                title: 'E1',
                state: 'failed',
                infohash: 'failed-hash',
              }),
            ],
          }),
        ],
      }),
    }
    const status = episodeStatusFor(
      ['srv-a', 'srv-b'],
      'bgm-1',
      'sg-1',
      'e1',
      statusByServer,
    )
    expect(status?.infohash).toBe('failed-hash')
    expect(
      episodeStateFor(
        ['srv-a', 'srv-b'],
        'bgm-1',
        'sg-1',
        'e1',
        statusByServer,
      ),
    ).toBe(status?.state)
  })
})

describe('subscriptionProgress', () => {
  it('counts ready and failed from the helper replica episode set', () => {
    const item = record({ id: 'sub-1', targetServerIds: ['srv-a'] })
    const progress = subscriptionProgress(
      item,
      state({
        statusByServer: {
          'srv-a': snapshot({
            replicas: [
              replica({
                id: 'sub-1',
                episodes: [
                  episode({ episodeId: 'e1', title: 'E1', state: 'done' }),
                  episode({ episodeId: 'e2', title: 'E2', state: 'failed' }),
                  episode({
                    episodeId: 'e3',
                    title: 'E3',
                    state: 'needs-manual',
                  }),
                  episode({
                    episodeId: 'e4',
                    title: 'E4',
                    state: 'downloading',
                  }),
                ],
              }),
            ],
          }),
        },
      }),
    )
    expect(progress).toEqual({ ready: 1, total: 4, failed: 2 })
  })

  it('uses the helper episode count as the denominator, not a bigger local count', () => {
    const item = record({ id: 'sub-1', targetServerIds: ['srv-a'] })
    const progress = subscriptionProgress(
      item,
      state({
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
    expect(progress.total).toBe(1)
  })

  it('does not double count an episode that is done on one target and downloading on another', () => {
    const item = record({
      id: 'sub-1',
      targetServerIds: ['srv-a', 'srv-b'],
    })
    const progress = subscriptionProgress(
      item,
      state({
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
          'srv-b': snapshot({
            replicas: [
              replica({
                id: 'sub-1',
                episodes: [
                  episode({
                    episodeId: 'e1',
                    title: 'E1',
                    state: 'downloading',
                  }),
                ],
              }),
            ],
          }),
        },
      }),
    )
    expect(progress).toEqual({ ready: 0, total: 1, failed: 0 })
  })
})
