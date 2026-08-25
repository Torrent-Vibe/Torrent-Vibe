import type { AgentChatStreamEvent } from '@torrent-vibe/shared'
import { describe, expect, it, vi } from 'vitest'

import { AgentChatStreamEmitter } from './stream-events'

const delta = (
  sequence: number,
  value: string,
): AgentChatStreamEvent & { type: 'text-delta' } => ({
  contentIndex: 0,
  delta: value,
  runId: 'run',
  sequence,
  sessionId: 'session',
  turn: 0,
  type: 'text-delta',
})

describe('AgentChatStreamEmitter', () => {
  it('coalesces adjacent deltas and flushes them before state events', () => {
    vi.useFakeTimers()
    const events: AgentChatStreamEvent[] = []
    const emitter = new AgentChatStreamEmitter((event) => events.push(event))

    emitter.push(delta(1, 'Hello'))
    emitter.push(delta(2, ' world'))
    emitter.emit({
      activity: {
        id: 'call',
        label: 'Query torrents',
        status: 'running',
        toolName: 'query_torrents',
      },
      runId: 'run',
      sequence: 3,
      sessionId: 'session',
      type: 'activity',
    })

    expect(events).toEqual([
      { ...delta(2, 'Hello world') },
      expect.objectContaining({ sequence: 3, type: 'activity' }),
    ])
    vi.useRealTimers()
  })
})
