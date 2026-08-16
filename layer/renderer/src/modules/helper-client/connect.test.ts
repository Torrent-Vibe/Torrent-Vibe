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

  it('pairs using the code returned by discover', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          version: '0.0.1',
          bindState: 'unbound',
          advertisedQbitUrl: 'http://127.0.0.1:18888',
          pairingCode: 'H8EUNK',
          port: 17890,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ token: 'tok-1' }))

    const result = await connectHelper('srv-a', 'http://10.0.0.32:17890/')

    expect(result).toEqual({ ok: true, url: 'http://10.0.0.32:17890' })
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://10.0.0.32:17890/pair')
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      code: 'H8EUNK',
    })
    expect(getHelperBinding('srv-a')).toEqual({
      url: 'http://10.0.0.32:17890',
      token: 'tok-1',
    })
  })

  it('rejects a helper already owned by another server', async () => {
    setHelperBinding('srv-a', { url: 'http://10.0.0.32:17890', token: 'a' })
    const result = await connectHelper('srv-b', 'http://10.0.0.32:17890')
    expect(result).toEqual({ ok: false, error: 'urlInUse', owner: 'srv-a' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns discoverFailed when the helper is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'))
    const result = await connectHelper('srv-a', 'http://10.0.0.32:17890')
    expect(result).toEqual({ ok: false, error: 'discoverFailed' })
  })

  it('returns pairFailed when discover has no pairing code', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        version: '0.0.1',
        bindState: 'bound',
        advertisedQbitUrl: '',
        pairingCode: '',
        port: 17890,
      }),
    )
    const result = await connectHelper('srv-a', 'http://10.0.0.32:17890')
    expect(result).toEqual({ ok: false, error: 'pairFailed' })
  })
})
