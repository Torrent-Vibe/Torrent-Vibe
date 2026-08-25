import type { QBittorrentConfig } from '@torrent-vibe/qb-client'
import { describe, expect, it } from 'vitest'

import { QbSessionPool } from './qb-session-pool'

const config = (host: string): QBittorrentConfig => ({
  host,
  password: 'secret',
  port: 8080,
  useHttps: false,
  username: 'admin',
})

describe('QbSessionPool scopes', () => {
  it('resolves a captured server after another server becomes active', () => {
    const pool = new QbSessionPool()
    const first = pool.setSharedConfig(config('server-a.local'), 'server-a')
    const second = pool.setSharedConfig(config('server-b.local'), 'server-b')

    expect(pool.getActive()).toBe(second)
    expect(pool.getByScopeId('server-a')).toBe(first)
  })
})
