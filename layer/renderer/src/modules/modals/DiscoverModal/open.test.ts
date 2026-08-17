import { describe, expect, it } from 'vitest'

import { discoverPath, isDiscoverProviderId } from './open'

describe('isDiscoverProviderId', () => {
  it('accepts registered providers', () => {
    expect(isDiscoverProviderId('mteam')).toBe(true)
    expect(isDiscoverProviderId('mikan')).toBe(true)
  })

  it('rejects missing or unknown values', () => {
    expect(isDiscoverProviderId(undefined)).toBe(false)
    expect(isDiscoverProviderId('')).toBe(false)
    expect(isDiscoverProviderId('nope')).toBe(false)
  })
})

describe('discoverPath', () => {
  it('builds the discover route', () => {
    expect(discoverPath('mikan')).toBe('/discover/mikan')
    expect(discoverPath('mteam')).toBe('/discover/mteam')
  })
})
