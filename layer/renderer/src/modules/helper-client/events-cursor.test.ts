import type { HelperEvent } from '@torrent-vibe/helper-protocol'
import { describe, expect, it } from 'vitest'

import { MAX_HELD_HELPER_EVENTS, mergeEventsPage } from './events-cursor'

const event = (seq: number): HelperEvent => ({
  seq,
  at: `2026-08-20T00:00:${String(seq % 60).padStart(2, '0')}.000Z`,
  level: 'info',
  kind: 'poll',
  message: `m${seq}`,
})

describe('mergeEventsPage', () => {
  it('appends a fresh page after the held events, preserving order', () => {
    const held = [event(1), event(2)]
    const page = [event(3), event(4)]
    expect(mergeEventsPage(held, page)).toEqual([
      event(1),
      event(2),
      event(3),
      event(4),
    ])
  })

  it('returns the same held list, unchanged, for an empty page', () => {
    const held = [event(1), event(2)]
    expect(mergeEventsPage(held, [])).toBe(held)
  })

  it('drops any seq from the page that is already held, never duplicating', () => {
    const held = [event(1), event(2), event(3)]
    const page = [event(2), event(3), event(4)]
    const merged = mergeEventsPage(held, page)
    expect(merged.map((entry) => entry.seq)).toEqual([1, 2, 3, 4])
  })

  it('survives a page whose events are entirely older than what is held', () => {
    const held = [event(5), event(6)]
    const page = [event(1), event(2)]
    expect(mergeEventsPage(held, page)).toBe(held)
  })

  it('caps the held list at MAX_HELD_HELPER_EVENTS, evicting the oldest first', () => {
    const held = Array.from({ length: MAX_HELD_HELPER_EVENTS }, (_, index) =>
      event(index + 1),
    )
    const page = [event(MAX_HELD_HELPER_EVENTS + 1)]
    const merged = mergeEventsPage(held, page)
    expect(merged).toHaveLength(MAX_HELD_HELPER_EVENTS)
    expect(merged[0]?.seq).toBe(2)
    expect(merged.at(-1)?.seq).toBe(MAX_HELD_HELPER_EVENTS + 1)
  })
})
