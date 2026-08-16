import { describe, expect, it } from 'vitest'

import {
  mikanBrowseBody,
  mikanDetailBangumiId,
  mikanSeasonControlsVisible,
  nextStackAfterBangumi,
  nextStackAfterSubscriptions,
  popMikanStack,
} from './stack'

describe('mikan stack', () => {
  it('pushes subscriptions only from browse', () => {
    expect(nextStackAfterSubscriptions([])).toEqual([{ type: 'subscriptions' }])
    expect(nextStackAfterSubscriptions([{ type: 'subscriptions' }])).toEqual([
      { type: 'subscriptions' },
    ])
    expect(
      nextStackAfterSubscriptions([{ type: 'bangumi', bangumiId: '1' }]),
    ).toEqual([{ type: 'bangumi', bangumiId: '1' }])
  })

  it('pushes bangumi from browse and from subscriptions', () => {
    expect(nextStackAfterBangumi([], 'a')).toEqual([
      { type: 'bangumi', bangumiId: 'a' },
    ])
    expect(nextStackAfterBangumi([{ type: 'subscriptions' }], 'a')).toEqual([
      { type: 'subscriptions' },
      { type: 'bangumi', bangumiId: 'a' },
    ])
  })

  it('replaces the top bangumi instead of growing a third frame', () => {
    const fromSubs = nextStackAfterBangumi(
      [{ type: 'subscriptions' }, { type: 'bangumi', bangumiId: 'a' }],
      'b',
    )
    expect(fromSubs).toEqual([
      { type: 'subscriptions' },
      { type: 'bangumi', bangumiId: 'b' },
    ])
    expect(
      nextStackAfterBangumi([{ type: 'bangumi', bangumiId: 'a' }], 'b'),
    ).toEqual([{ type: 'bangumi', bangumiId: 'b' }])
  })

  it('pops one frame and clears the detail pointer when bangumi leaves', () => {
    const stacked = [
      { type: 'subscriptions' as const },
      { type: 'bangumi' as const, bangumiId: 'a' },
    ]
    expect(mikanDetailBangumiId(stacked)).toBe('a')
    const afterBangumi = popMikanStack(stacked)
    expect(afterBangumi).toEqual([{ type: 'subscriptions' }])
    expect(mikanDetailBangumiId(afterBangumi)).toBeNull()
    expect(popMikanStack(afterBangumi)).toEqual([])
    expect(mikanDetailBangumiId([])).toBeNull()
  })
})

describe('mikan browse mode', () => {
  it('hides season controls as soon as the keyword is non-empty', () => {
    expect(mikanSeasonControlsVisible('')).toBe(true)
    expect(mikanSeasonControlsVisible('   ')).toBe(true)
    expect(mikanSeasonControlsVisible('芙')).toBe(false)
  })

  it('uses the committed keyword for the body', () => {
    expect(mikanBrowseBody('')).toBe('wall')
    expect(mikanBrowseBody('   ')).toBe('wall')
    expect(mikanBrowseBody(null)).toBe('wall')
    expect(mikanBrowseBody('芙莉莲')).toBe('search')
  })
})
