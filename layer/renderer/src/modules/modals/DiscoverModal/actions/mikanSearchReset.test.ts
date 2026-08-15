import { describe, expect, it } from 'vitest'

import { shouldResetMikanItems } from './mikanSearchReset'

describe('shouldResetMikanItems', () => {
  it('resets when clearing a mikan search', () => {
    expect(shouldResetMikanItems('mikan', '芙莉莲', '')).toBe(true)
    expect(shouldResetMikanItems('mikan', '芙莉莲', '   ')).toBe(true)
  })

  it('resets when leaving the season wall for a mikan search', () => {
    expect(shouldResetMikanItems('mikan', '', '芙莉莲')).toBe(true)
    expect(shouldResetMikanItems('mikan', null, '芙莉莲')).toBe(true)
    expect(shouldResetMikanItems('mikan', undefined, '芙莉莲')).toBe(true)
  })

  it('keeps items when staying on the wall or refining a search', () => {
    expect(shouldResetMikanItems('mikan', '', '')).toBe(false)
    expect(shouldResetMikanItems('mikan', '   ', '')).toBe(false)
    expect(shouldResetMikanItems('mikan', '芙', '芙莉莲')).toBe(false)
  })

  it('does not reset items for other providers', () => {
    expect(shouldResetMikanItems('mteam', 'keyword', '')).toBe(false)
    expect(shouldResetMikanItems('mteam', '', 'keyword')).toBe(false)
  })
})
