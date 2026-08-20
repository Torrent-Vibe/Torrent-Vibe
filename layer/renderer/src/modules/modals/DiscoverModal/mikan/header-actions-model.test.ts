import { describe, expect, it } from 'vitest'

import type { MikanBangumiExtra } from '~/modules/discover/providers/mikan/utils'

import {
  buildSubscribeInput,
  resolveHeaderActionMenuItems,
  resolveHeaderActionMode,
} from './header-actions-model'

describe('resolveHeaderActionMode', () => {
  it('is manage whenever subscribed, regardless of paired or hasSubgroups', () => {
    for (const paired of [true, false]) {
      for (const hasSubgroups of [true, false]) {
        expect(
          resolveHeaderActionMode({ paired, subscribed: true, hasSubgroups }),
        ).toEqual({ type: 'manage' })
      }
    }
  })

  it('opens pairing when unsubscribed and no helper is paired, regardless of hasSubgroups', () => {
    for (const hasSubgroups of [true, false]) {
      expect(
        resolveHeaderActionMode({
          paired: false,
          subscribed: false,
          hasSubgroups,
        }),
      ).toEqual({ type: 'subscribe', trigger: 'openPairing' })
    }
  })

  it('flags noSubgroups when paired, unsubscribed, and the bangumi has no subgroups', () => {
    expect(
      resolveHeaderActionMode({
        paired: true,
        subscribed: false,
        hasSubgroups: false,
      }),
    ).toEqual({ type: 'subscribe', trigger: 'noSubgroups' })
  })

  it('allows subscribing when paired, unsubscribed, and a subgroup exists', () => {
    expect(
      resolveHeaderActionMode({
        paired: true,
        subscribed: false,
        hasSubgroups: true,
      }),
    ).toEqual({ type: 'subscribe', trigger: 'subscribe' })
  })

  it('never yields a mode that would justify disabling the button', () => {
    const validTypes = new Set(['manage', 'subscribe'])
    for (const paired of [true, false]) {
      for (const subscribed of [true, false]) {
        for (const hasSubgroups of [true, false]) {
          const mode = resolveHeaderActionMode({
            paired,
            subscribed,
            hasSubgroups,
          })
          expect(validTypes.has(mode.type)).toBe(true)
        }
      }
    }
  })
})

describe('resolveHeaderActionMenuItems', () => {
  it('omits checkNow when no target server supports the check capability', () => {
    expect(
      resolveHeaderActionMenuItems({
        targetServerIds: ['srv-a', 'srv-b'],
        checkSupportByServerId: { 'srv-a': false, 'srv-b': false },
      }),
    ).toEqual(['editTargets', 'unsubscribe'])
  })

  it('includes checkNow when at least one target server supports check', () => {
    expect(
      resolveHeaderActionMenuItems({
        targetServerIds: ['srv-a', 'srv-b'],
        checkSupportByServerId: { 'srv-a': false, 'srv-b': true },
      }),
    ).toEqual(['editTargets', 'checkNow', 'unsubscribe'])
  })

  it('omits checkNow when there are no target servers at all', () => {
    expect(
      resolveHeaderActionMenuItems({
        targetServerIds: [],
        checkSupportByServerId: {},
      }),
    ).toEqual(['editTargets', 'unsubscribe'])
  })
})

describe('buildSubscribeInput', () => {
  const extra: MikanBangumiExtra = {
    kind: 'bangumi',
    coverUrl: 'https://example.com/cover.jpg',
    bangumiSubjectId: 'bgm-123',
    subgroups: [
      { id: 'sg-1', name: 'ANi' },
      { id: 'sg-2', name: 'Sakura' },
    ],
    episodes: [
      {
        episodeId: 'e1',
        title: 'Ep1 ANi',
        torrentUrl: 'https://t/e1',
        subgroupId: 'sg-1',
      },
      {
        episodeId: 'e2',
        title: 'Ep2 ANi',
        torrentUrl: 'https://t/e2',
        subgroupId: 'sg-1',
      },
      {
        episodeId: 'e3',
        title: 'Ep1 Sakura',
        torrentUrl: 'https://t/e3',
        subgroupId: 'sg-2',
      },
    ],
  }

  it('assembles the remaining fields the same as before', () => {
    const result = buildSubscribeInput({
      bangumiId: 'bgm-1',
      title: 'Frieren',
      extra,
      subgroupId: 'sg-1',
      currentTargetServerIds: ['srv-a'],
      currentServerId: 'srv-b',
    })
    expect(result.bangumiId).toBe('bgm-1')
    expect(result.title).toBe('Frieren')
    expect(result.coverUrl).toBe('https://example.com/cover.jpg')
    expect(result.bangumiSubjectId).toBe('bgm-123')
    expect(result.subgroupId).toBe('sg-1')
    expect(result.subgroupName).toBe('ANi')
    expect(result.initialIds).toEqual(['srv-a'])
  })

  it('falls back to the current server id when there is no existing subscription', () => {
    const result = buildSubscribeInput({
      bangumiId: 'bgm-1',
      title: 'Frieren',
      extra,
      subgroupId: 'sg-1',
      currentTargetServerIds: null,
      currentServerId: 'srv-b',
    })
    expect(result.initialIds).toEqual(['srv-b'])
  })

  it('falls back to no initial targets when neither is available', () => {
    const result = buildSubscribeInput({
      bangumiId: 'bgm-1',
      title: 'Frieren',
      extra,
      subgroupId: 'sg-1',
      currentTargetServerIds: null,
      currentServerId: null,
    })
    expect(result.initialIds).toEqual([])
  })

  it('falls back to the subgroup id as the name when the subgroup is unknown', () => {
    const result = buildSubscribeInput({
      bangumiId: 'bgm-1',
      title: 'Frieren',
      extra,
      subgroupId: 'sg-missing',
      currentTargetServerIds: null,
      currentServerId: null,
    })
    expect(result.subgroupName).toBe('sg-missing')
  })

  it('includes episodes only, and exactly, for the selected subgroup', () => {
    const result = buildSubscribeInput({
      bangumiId: 'bgm-1',
      title: 'Frieren',
      extra,
      subgroupId: 'sg-1',
      currentTargetServerIds: null,
      currentServerId: null,
    })
    expect(result.episodes.map((episode) => episode.episodeId)).toEqual([
      'e1',
      'e2',
    ])
  })

  it('returns an empty episodes array, not undefined, when the subgroup has no releases', () => {
    const result = buildSubscribeInput({
      bangumiId: 'bgm-1',
      title: 'Frieren',
      extra,
      subgroupId: 'sg-empty',
      currentTargetServerIds: null,
      currentServerId: null,
    })
    expect(result.episodes).toEqual([])
  })

  it('returns an empty episodes array when there is no detail extra at all', () => {
    const result = buildSubscribeInput({
      bangumiId: 'bgm-1',
      title: 'Frieren',
      extra: null,
      subgroupId: 'sg-1',
      currentTargetServerIds: null,
      currentServerId: null,
    })
    expect(result.episodes).toEqual([])
  })
})
