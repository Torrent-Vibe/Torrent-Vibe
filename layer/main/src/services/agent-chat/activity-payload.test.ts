import { describe, expect, it } from 'vitest'

import { extractActivityPayload, summarizeToolResult } from './activity-payload'

describe('activity payload', () => {
  it('parses JSON tool content for structured rendering', () => {
    const result = {
      content: [
        { type: 'text', text: '{"count":2,"torrents":[{"name":"A"}]}' },
      ],
      details: { count: 2 },
    }

    expect(extractActivityPayload(result)).toEqual({
      count: 2,
      torrents: [{ name: 'A' }],
    })
    expect(summarizeToolResult(result)).toMatch(/^{"count":2/)
  })

  it('keeps non-JSON bash output as truncated text', () => {
    const output = 'stdout line\n'.repeat(400)
    const result = {
      content: [{ type: 'text', text: output }],
      details: {},
    }

    expect(extractActivityPayload(result)).toEqual({
      output: expect.stringContaining('...[truncated]'),
    })
  })
})
