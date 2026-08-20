import { describe, expect, it } from 'vitest'

import type { HelperCapabilities } from './capabilities'
import { defaultHelperLogTab, helperLogTabState } from './helper-log-tabs'

const capabilities = (
  overrides: Partial<HelperCapabilities>,
): HelperCapabilities => ({
  check: false,
  events: false,
  logs: false,
  ...overrides,
})

describe('helperLogTabState', () => {
  it('events tab is available whenever capabilities.events is true, regardless of logs', () => {
    expect(
      helperLogTabState('events', capabilities({ events: true, logs: true })),
    ).toBe('available')
    expect(
      helperLogTabState('events', capabilities({ events: true, logs: false })),
    ).toBe('available')
  })

  it('events tab is unavailable whenever capabilities.events is false, regardless of logs', () => {
    expect(
      helperLogTabState('events', capabilities({ events: false, logs: true })),
    ).toBe('unavailable')
    expect(
      helperLogTabState('events', capabilities({ events: false, logs: false })),
    ).toBe('unavailable')
  })

  it('raw tab is available whenever capabilities.logs is true, regardless of events', () => {
    expect(
      helperLogTabState('raw', capabilities({ events: true, logs: true })),
    ).toBe('available')
    expect(
      helperLogTabState('raw', capabilities({ events: false, logs: true })),
    ).toBe('available')
  })

  it('raw tab is unavailable whenever capabilities.logs is false, regardless of events', () => {
    expect(
      helperLogTabState('raw', capabilities({ events: true, logs: false })),
    ).toBe('unavailable')
    expect(
      helperLogTabState('raw', capabilities({ events: false, logs: false })),
    ).toBe('unavailable')
  })
})

describe('defaultHelperLogTab', () => {
  it('defaults to events when events is supported, regardless of logs', () => {
    expect(
      defaultHelperLogTab(capabilities({ events: true, logs: true })),
    ).toBe('events')
    expect(
      defaultHelperLogTab(capabilities({ events: true, logs: false })),
    ).toBe('events')
  })

  it('falls back to raw when events is unsupported but logs is supported', () => {
    expect(
      defaultHelperLogTab(capabilities({ events: false, logs: true })),
    ).toBe('raw')
  })

  it('defaults to events when neither is supported, so the notice has a tab to land on', () => {
    expect(
      defaultHelperLogTab(capabilities({ events: false, logs: false })),
    ).toBe('events')
  })
})
