import { describe, expect, it } from 'vitest'

import { decorateMdnsRows } from './mdns-rows'

describe('decorateMdnsRows', () => {
  it('disables a URL already bound to another server', () => {
    const rows = decorateMdnsRows(
      [{ name: 'nas', host: 'nas.local', port: 17890, version: '0.0.1' }],
      { 'srv-a': { url: 'http://nas.local:17890', token: 't' } },
      'srv-b',
      { 'srv-a': 'NAS A' },
    )
    expect(rows[0]?.disabled).toBe(true)
    expect(rows[0]?.ownerName).toBe('NAS A')
  })

  it('keeps the current server row enabled', () => {
    const rows = decorateMdnsRows(
      [{ name: 'nas', host: 'nas.local', port: 17890, version: '0.0.1' }],
      { 'srv-a': { url: 'http://nas.local:17890', token: 't' } },
      'srv-a',
      { 'srv-a': 'NAS A' },
    )
    expect(rows[0]?.disabled).toBe(false)
  })
})
