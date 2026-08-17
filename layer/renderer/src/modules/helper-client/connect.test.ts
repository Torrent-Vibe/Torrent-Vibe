import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getHelperBinding,
  setHelperBinding,
  useHelperBindingsStore,
} from './bindings'
import { connectHelper } from './connect'

const jsonResponse = (data: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )

describe('connectHelper', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    useHelperBindingsStore.setState({ bindings: {} })
    localStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pairs using a user-entered code and stable client identity', async () => {
    localStorage.setItem('app:helper-client-id', 'desktop-1')
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          version: '0.0.1',
          bindState: 'unbound',
          advertisedQbitUrl: 'http://127.0.0.1:18888',
          clientCount: 0,
          port: 17890,
          requiresPairingCode: true,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ clientId: 'desktop-1', token: 'tok-1' }),
      )

    const result = await connectHelper(
      'srv-a',
      'http://10.0.0.32:17890/',
      'h8eunk',
    )

    expect(result).toEqual({ ok: true, url: 'http://10.0.0.32:17890' })
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://10.0.0.32:17890/pair')
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      clientId: 'desktop-1',
      clientName: 'Torrent Vibe Web',
      code: 'H8EUNK',
    })
    expect(getHelperBinding('srv-a')).toEqual({
      clientId: 'desktop-1',
      url: 'http://10.0.0.32:17890',
      token: 'tok-1',
    })
  })

  it('rejects a helper already owned by another server', async () => {
    setHelperBinding('srv-a', { url: 'http://10.0.0.32:17890', token: 'a' })
    const result = await connectHelper(
      'srv-b',
      'http://10.0.0.32:17890',
      'ABC234',
    )
    expect(result).toEqual({ ok: false, error: 'urlInUse', owner: 'srv-a' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns discoverFailed when the helper is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'))
    const result = await connectHelper(
      'srv-a',
      'http://10.0.0.32:17890',
      'ABC234',
    )
    expect(result).toEqual({ ok: false, error: 'discoverFailed' })
  })

  it('returns pairFailed when helper does not require the pairing-code contract', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        version: '0.0.1',
        bindState: 'bound',
        advertisedQbitUrl: '',
        clientCount: 1,
        port: 17890,
        requiresPairingCode: false,
      }),
    )
    const result = await connectHelper(
      'srv-a',
      'http://10.0.0.32:17890',
      'ABC234',
    )
    expect(result).toEqual({ ok: false, error: 'pairFailed' })
  })
})
