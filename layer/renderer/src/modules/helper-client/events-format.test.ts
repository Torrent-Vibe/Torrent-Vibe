import type { HelperEvent } from '@torrent-vibe/helper-protocol'
import { describe, expect, it } from 'vitest'

import { formatHelperEventsForCopy } from './events-format'

describe('formatHelperEventsForCopy', () => {
  it('formats a single event as one line with timestamp, level, kind and message', () => {
    const event: HelperEvent = {
      seq: 1,
      at: '2026-08-20T00:00:00.000Z',
      level: 'error',
      kind: 'subscription.check',
      message: 'RSS returned 403',
    }
    expect(formatHelperEventsForCopy([event])).toBe(
      '2026-08-20T00:00:00.000Z [error] subscription.check RSS returned 403',
    )
  })

  it('appends structured fields as trailing JSON', () => {
    const event: HelperEvent = {
      seq: 1,
      at: '2026-08-20T00:00:00.000Z',
      level: 'info',
      kind: 'poll',
      message: 'checked',
      fields: { status: 403 },
    }
    expect(formatHelperEventsForCopy([event])).toBe(
      '2026-08-20T00:00:00.000Z [info] poll checked {"status":403}',
    )
  })

  it('joins multiple events with newlines, preserving order', () => {
    const events: HelperEvent[] = [
      { seq: 1, at: 't1', level: 'info', kind: 'a', message: 'first' },
      { seq: 2, at: 't2', level: 'warn', kind: 'b', message: 'second' },
    ]
    expect(formatHelperEventsForCopy(events)).toBe(
      't1 [info] a first\nt2 [warn] b second',
    )
  })

  it('returns an empty string for an empty list', () => {
    expect(formatHelperEventsForCopy([])).toBe('')
  })
})
