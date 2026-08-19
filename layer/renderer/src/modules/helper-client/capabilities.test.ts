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
})
