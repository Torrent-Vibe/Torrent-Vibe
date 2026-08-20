import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { checkHelper, getHelperEvents, getHelperLogs } from './events-api'

const jsonResponse = (data: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )

const textResponse = (data: string, status = 200) =>
  Promise.resolve(
    new Response(data, {
      status,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    }),
  )

describe('getHelperEvents', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses a well-formed events payload', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        events: [
          {
            seq: 1,
            at: '2026-08-20T00:00:00Z',
            level: 'info',
            kind: 'subscription.check',
            replicaId: 'r1',
            bangumiId: 'b1',
            subgroupId: 'sg1',
            episodeId: 'e1',
            message: 'checked',
            fields: { source: 'poll' },
          },
        ],
        cursor: 7,
      }),
    )

    const result = await getHelperEvents('http://nas:17890', 'tok')

    expect(result).toEqual({
      cursor: 7,
      events: [
        {
          seq: 1,
          at: '2026-08-20T00:00:00Z',
          level: 'info',
          kind: 'subscription.check',
          replicaId: 'r1',
          bangumiId: 'b1',
          subgroupId: 'sg1',
          episodeId: 'e1',
          message: 'checked',
          fields: { source: 'poll' },
        },
      ],
    })
  })

  it('builds the query string from the provided filters', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ events: [], cursor: 0 }))

    await getHelperEvents('http://nas:17890', 'tok', {
      since: 5,
      level: 'warn',
      replicaId: 'r1',
      kind: 'subscription.put',
      limit: 50,
    })

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.pathname).toBe('/events')
    expect(url.searchParams.get('since')).toBe('5')
    expect(url.searchParams.get('level')).toBe('warn')
    expect(url.searchParams.get('replicaId')).toBe('r1')
    expect(url.searchParams.get('kind')).toBe('subscription.put')
    expect(url.searchParams.get('limit')).toBe('50')
  })

  it('tolerates missing optional fields on an event and a malformed top-level body', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        events: [
          {
            seq: 2,
            at: '2026-08-20T00:01:00Z',
            level: 'error',
            kind: 'k',
            message: 'm',
          },
          { seq: 'not-a-number', message: 'dropped' },
          null,
        ],
        cursor: 9,
      }),
    )
    const withGaps = await getHelperEvents('http://nas:17890', 'tok')
    expect(withGaps).toEqual({
      cursor: 9,
      events: [
        {
          seq: 2,
          at: '2026-08-20T00:01:00Z',
          level: 'error',
          kind: 'k',
          message: 'm',
        },
      ],
    })

    fetchMock.mockResolvedValueOnce(jsonResponse({ nonsense: true }))
    const malformed = await getHelperEvents('http://nas:17890', 'tok')
    expect(malformed).toEqual({ cursor: 0, events: [] })
  })
})

describe('getHelperLogs', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches raw text with the tail parameter', async () => {
    fetchMock.mockResolvedValueOnce(textResponse('line1\nline2\n'))

    const result = await getHelperLogs('http://nas:17890', 'tok', 100)

    expect(result).toBe('line1\nline2\n')
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.pathname).toBe('/logs')
    expect(url.searchParams.get('tail')).toBe('100')
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toBeInstanceOf(Headers)
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(headers.get('authorization')).toBe('Bearer tok')
  })

  it('omits the tail parameter when not given', async () => {
    fetchMock.mockResolvedValueOnce(textResponse(''))

    await getHelperLogs('http://nas:17890', 'tok')

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.searchParams.has('tail')).toBe(false)
  })

  it('throws on a non-ok response', async () => {
    fetchMock.mockResolvedValueOnce(textResponse('nope', 500))
    await expect(getHelperLogs('http://nas:17890', 'tok')).rejects.toThrow(
      'helper 500',
    )
  })
})

describe('checkHelper', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs to /check and resolves on a 202', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }, 202))

    await expect(
      checkHelper('http://nas:17890', 'tok'),
    ).resolves.toBeUndefined()

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://nas:17890/check')
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
  })

  it('surfaces a helper <status> error, not a SyntaxError, when a legacy Helper 404s with a plain-text body', async () => {
    fetchMock.mockResolvedValueOnce(textResponse('404 page not found\n', 404))

    await expect(checkHelper('http://nas:17890', 'tok')).rejects.toThrow(
      'helper 404',
    )
  })
})
