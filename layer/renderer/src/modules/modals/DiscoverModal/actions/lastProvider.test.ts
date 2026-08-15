import { describe, expect, it } from 'vitest'

import { resolveLastProvider, selectDiscoverProvider } from './lastProvider'

describe('resolveLastProvider', () => {
  it('returns remembered when it is ready', () => {
    expect(resolveLastProvider('mikan', ['mteam', 'mikan'])).toBe('mikan')
  })

  it('returns the first ready id when remembered is missing', () => {
    expect(resolveLastProvider(null, ['mteam', 'mikan'])).toBe('mteam')
    expect(resolveLastProvider(undefined, ['mikan'])).toBe('mikan')
  })

  it('falls back to the first ready id when remembered is not ready', () => {
    expect(resolveLastProvider('mikan', ['mteam'])).toBe('mteam')
  })

  it('returns null when no provider is ready', () => {
    expect(resolveLastProvider('mikan', [])).toBeNull()
    expect(resolveLastProvider(null, [])).toBeNull()
  })

  it('keeps readyIds order when falling back', () => {
    expect(resolveLastProvider('missing', ['mikan', 'mteam'])).toBe('mikan')
  })
})

describe('selectDiscoverProvider', () => {
  const options = [
    { id: 'mikan', ready: true },
    { id: 'mteam', ready: false },
  ] as const

  it('activates a ready provider', () => {
    expect(selectDiscoverProvider('mikan', options)).toBe('activate')
  })

  it('opens settings when the provider is not ready', () => {
    expect(selectDiscoverProvider('mteam', options)).toBe('settings')
  })
})
