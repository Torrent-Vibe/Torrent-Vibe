import type { HelperEvent } from '@torrent-vibe/helper-protocol'
import { describe, expect, it } from 'vitest'

import { filterHelperEvents } from './events-filter'

const baseEvent: HelperEvent = {
  seq: 1,
  at: '2026-08-20T00:00:00.000Z',
  level: 'info',
  kind: 'poll',
  message: 'checked feed',
}

const withOverrides = (overrides: Partial<HelperEvent>): HelperEvent => ({
  ...baseEvent,
  ...overrides,
})

describe('filterHelperEvents', () => {
  it('excludes debug events when the level filter is info', () => {
    const events = [
      withOverrides({ seq: 1, level: 'debug', message: 'debug msg' }),
      withOverrides({ seq: 2, level: 'info' }),
    ]
    const result = filterHelperEvents(events, { level: 'info' })
    expect(result).toHaveLength(1)
    expect(result[0]?.level).toBe('info')
  })

  it('includes debug events when the level filter opts into debug', () => {
    const events = [
      withOverrides({ seq: 1, level: 'debug' }),
      withOverrides({ seq: 2, level: 'error' }),
    ]
    expect(filterHelperEvents(events, { level: 'debug' })).toHaveLength(2)
  })

  it('keeps warn and error when filtering at info and above', () => {
    const events = [
      withOverrides({ seq: 1, level: 'debug' }),
      withOverrides({ seq: 2, level: 'info' }),
      withOverrides({ seq: 3, level: 'warn' }),
      withOverrides({ seq: 4, level: 'error' }),
    ]
    expect(
      filterHelperEvents(events, { level: 'info' }).map((entry) => entry.level),
    ).toEqual(['info', 'warn', 'error'])
  })

  it('matches free-text search against the message, case-insensitively', () => {
    const events = [
      withOverrides({ seq: 1, message: 'RSS fetch failed' }),
      withOverrides({ seq: 2, message: 'ok' }),
    ]
    expect(
      filterHelperEvents(events, { level: 'debug', search: 'rss fetch' }),
    ).toEqual([events[0]])
  })

  it('matches free-text search against structured fields', () => {
    const events = [
      withOverrides({ seq: 1, message: 'checked', fields: { status: 403 } }),
      withOverrides({ seq: 2, message: 'checked', fields: { status: 200 } }),
    ]
    expect(
      filterHelperEvents(events, { level: 'debug', search: '403' }),
    ).toEqual([events[0]])
  })

  it('matches free-text search against replicaId, bangumiId, subgroupId and episodeId', () => {
    const events = [
      withOverrides({ seq: 1, message: 'x', replicaId: 'replica-42' }),
      withOverrides({ seq: 2, message: 'y', replicaId: 'other' }),
    ]
    expect(
      filterHelperEvents(events, { level: 'debug', search: 'replica-42' }),
    ).toEqual([events[0]])
  })

  it('treats a blank search as no filter', () => {
    const events = [
      withOverrides({ seq: 1, message: 'a' }),
      withOverrides({ seq: 2, message: 'b' }),
    ]
    expect(
      filterHelperEvents(events, { level: 'debug', search: '   ' }),
    ).toEqual(events)
  })

  it('combines the level and search filters', () => {
    const events = [
      withOverrides({ seq: 1, level: 'debug', message: 'match' }),
      withOverrides({ seq: 2, level: 'info', message: 'match' }),
      withOverrides({ seq: 3, level: 'info', message: 'no' }),
    ]
    expect(
      filterHelperEvents(events, { level: 'info', search: 'match' }),
    ).toEqual([events[1]])
  })
})
