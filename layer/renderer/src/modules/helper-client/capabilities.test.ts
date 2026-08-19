import { describe, expect, it } from 'vitest'

import { helperCapabilities } from './capabilities'

describe('helperCapabilities', () => {
  it('reports events, logs and check as advertised', () => {
    expect(
      helperCapabilities(['profile-sync-v1', 'events', 'logs', 'check']),
    ).toEqual({ events: true, logs: true, check: true })
  })

  it('reports missing capabilities as false for an older Helper', () => {
    expect(helperCapabilities(['profile-sync-v1'])).toEqual({
      events: false,
      logs: false,
      check: false,
    })
  })

  it('degrades to all-false for undefined or null capability lists', () => {
    expect(helperCapabilities(undefined)).toEqual({
      events: false,
      logs: false,
      check: false,
    })
    expect(helperCapabilities(null)).toEqual({
      events: false,
      logs: false,
      check: false,
    })
  })

  it('degrades to all-false instead of throwing for a non-array value off the wire', () => {
    expect(helperCapabilities({ events: true } as unknown as string[])).toEqual(
      { events: false, logs: false, check: false },
    )
    expect(helperCapabilities(42 as unknown as string[])).toEqual({
      events: false,
      logs: false,
      check: false,
    })
  })

  it('ignores non-string entries in an array off the wire', () => {
    expect(
      helperCapabilities([
        'events',
        42,
        null,
        { kind: 'check' },
      ] as unknown as string[]),
    ).toEqual({ events: true, logs: false, check: false })
  })
})
