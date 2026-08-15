import { describe, expect, it } from 'vitest'

import { mikanBrowseMode } from './helpers'

describe('mikanBrowseMode', () => {
  it('keeps 我的订阅 only when the keyword is empty', () => {
    expect(mikanBrowseMode('subscriptions', '')).toBe('subscriptions')
    expect(mikanBrowseMode('subscriptions', '   ')).toBe('subscriptions')
  })

  it('switches to search browse when a keyword is typed', () => {
    expect(mikanBrowseMode('subscriptions', '葬送')).toBe('browse')
  })

  it('keeps the season wall when that tab is selected', () => {
    expect(mikanBrowseMode('season', '')).toBe('browse')
    expect(mikanBrowseMode('season', '葬送')).toBe('browse')
  })
})
