import { describe, expect, it } from 'vitest'

import { createQbClient, extractTorrentInfohash } from './qb'

const HASH = 'a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c'
const TORRENT_URL = `https://mikan.example/Download/20240322/${HASH}.torrent`

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function createFetch(options: {
  addBody?: string
  addStatus?: number
  torrents?: Array<{
    hash: string
    name: string
    progress: number
    state: string
  }>
}) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url.endsWith('/api/v2/auth/login')) {
      return new Response('Ok.', {
        status: 200,
        headers: { 'set-cookie': 'SID=test-sid; Path=/' },
      })
    }
    if (url.includes('/api/v2/torrents/add') && method === 'POST') {
      return new Response(options.addBody ?? 'Ok.', {
        status: options.addStatus ?? 200,
      })
    }
    if (url.includes('/api/v2/torrents/info')) {
      return jsonResponse(options.torrents ?? [])
    }
    throw new Error(`unexpected ${method} ${url}`)
  }
}

describe('extractTorrentInfohash', () => {
  it('reads a 40-char hash from a Mikan download URL', () => {
    expect(extractTorrentInfohash(TORRENT_URL)).toBe(HASH)
  })
})

describe('createQbClient.addTorrent', () => {
  const request = {
    urls: TORRENT_URL,
    savepath: '/library/Show/Season 01',
    category: 'Bangumi',
    tags: 'tv-mikan:sub-1',
    rename: 'Show - S01E01',
  }

  it('throws when qBit returns HTTP 200 with Fails.', async () => {
    const client = createQbClient({
      baseUrl: 'http://127.0.0.1:8080',
      username: 'admin',
      password: 'pass',
      fetch: createFetch({ addBody: 'Fails.' }),
    })

    await expect(client.addTorrent(request)).rejects.toThrow(
      /qBittorrent add failed/,
    )
  })

  it('does not treat the URL hash as success when the body is Fails.', async () => {
    const client = createQbClient({
      baseUrl: 'http://127.0.0.1:8080',
      username: 'admin',
      password: 'pass',
      fetch: createFetch({
        addBody: 'Fails.\n',
        torrents: [
          {
            hash: HASH,
            name: 'unrelated',
            progress: 0,
            state: 'downloading',
          },
        ],
      }),
    })

    await expect(client.addTorrent(request)).rejects.toThrow(
      /qBittorrent add failed/,
    )
  })

  it('returns the URL hash after Ok. when the torrent is listed', async () => {
    const client = createQbClient({
      baseUrl: 'http://127.0.0.1:8080',
      username: 'admin',
      password: 'pass',
      fetch: createFetch({
        addBody: 'Ok.',
        torrents: [
          {
            hash: HASH,
            name: 'Show - S01E01',
            progress: 0,
            state: 'downloading',
          },
        ],
      }),
    })

    await expect(client.addTorrent(request)).resolves.toEqual({ hash: HASH })
  })

  it('throws when Ok. is missing and the hash is not listed', async () => {
    const client = createQbClient({
      baseUrl: 'http://127.0.0.1:8080',
      username: 'admin',
      password: 'pass',
      fetch: createFetch({ addBody: '', torrents: [] }),
    })

    await expect(client.addTorrent(request)).rejects.toThrow(
      /qBittorrent add failed/,
    )
  })
})
