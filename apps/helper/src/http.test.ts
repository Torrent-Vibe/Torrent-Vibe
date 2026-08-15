import { mkdtemp, rm } from 'node:fs/promises'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { HelperReplica } from '@torrent-vibe/helper-protocol'
import { afterEach, describe, expect, it } from 'vitest'

import { createHelperServer } from './http'
import type { HelperEpisode } from './store'
import { createFileReplicaStore } from './store'

const TOKEN = 'test-token'
const PAIRING_CODE = 'ABC234'

function replica(
  partial: Pick<HelperReplica, 'id'> & Partial<HelperReplica>,
): HelperReplica {
  return {
    bangumiId: 'bgm-1',
    title: 'Title',
    subgroupId: 'sg-1',
    subgroupName: 'Subgroup',
    rssUrl: 'https://example.com/rss',
    ...partial,
  }
}

function memoryStore(initial: HelperReplica[] = []) {
  let replicas = [...initial]
  let episodes: Record<string, HelperEpisode[]> = {}
  return {
    async load() {
      return [...replicas]
    },
    async save(next: HelperReplica[]) {
      replicas = [...next]
      const ids = new Set(next.map(item => item.id))
      episodes = Object.fromEntries(
        Object.entries(episodes).filter(([id]) => ids.has(id)),
      )
    },
    async loadEpisodes() {
      return Object.fromEntries(
        Object.entries(episodes).map(([id, list]) => [id, [...list]]),
      )
    },
    async saveEpisodes(next: Record<string, HelperEpisode[]>) {
      episodes = Object.fromEntries(
        Object.entries(next).map(([id, list]) => [id, [...list]]),
      )
    },
  }
}

function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()))
  })
}

describe('helper HTTP', () => {
  let server: Server | undefined

  afterEach(async () => {
    if (!server) {
      return
    }
    await close(server)
    server = undefined
  })

  function start(options?: {
    store?: ReturnType<typeof memoryStore>
    token?: string
    pairingCode?: string
    onBackfill?: (input: {
      bangumiId: string
      subgroupId: string
      episodes: Array<{
        episodeId: string
        title: string
        torrentUrl: string
      }>
    }) => Promise<unknown>
  }) {
    server = createHelperServer({
      config: {
        libraryRoot: '/library',
        qbitUrl: 'http://127.0.0.1:8080',
        qbitUser: 'admin',
        qbitPass: 'pass',
        token: options?.token ?? TOKEN,
        port: 17890,
        version: '0.0.1-test',
        pollIntervalMs: 600_000,
      },
      pairingCode: options?.pairingCode ?? PAIRING_CODE,
      store: options?.store ?? memoryStore(),
      onBackfill: options?.onBackfill,
    })
    return listen(server)
  }

  it('gET /discover is unauthenticated and returns helper identity', async () => {
    const base = await start()
    const response = await fetch(`${base}/discover`)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      version: '0.0.1-test',
      bindState: 'unbound',
      advertisedQbitUrl: 'http://127.0.0.1:8080',
      pairingCode: PAIRING_CODE,
      port: 17890,
    })
  })

  it('pOST /pair rejects a wrong or missing code', async () => {
    const base = await start()
    const wrong = await fetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'ZZZZZZ' }),
    })
    expect(wrong.status).toBe(403)

    const missing = await fetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(missing.status).toBe(403)
  })

  it('pOST /pair returns the token and later accepts the same code', async () => {
    const base = await start()
    const first = await fetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: PAIRING_CODE }),
    })
    expect(first.status).toBe(200)
    await expect(first.json()).resolves.toEqual({ token: TOKEN })

    const discover = await fetch(`${base}/discover`)
    await expect(discover.json()).resolves.toMatchObject({
      bindState: 'bound',
    })

    const second = await fetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: PAIRING_CODE }),
    })
    expect(second.status).toBe(200)
    await expect(second.json()).resolves.toEqual({ token: TOKEN })
  })

  it('rejects authenticated routes without a valid bearer token', async () => {
    const base = await start()
    const routes = [
      ['GET', '/subscriptions'],
      ['PUT', '/subscriptions'],
      ['GET', '/status'],
      ['POST', '/backfill'],
    ] as const

    for (const [method, path] of routes) {
      const missing = await fetch(`${base}${path}`, { method })
      expect(missing.status).toBe(401)

      const wrong = await fetch(`${base}${path}`, {
        method,
        headers: { authorization: 'Bearer nope' },
      })
      expect(wrong.status).toBe(401)
    }
  })

  it('gET /subscriptions returns the current replica list', async () => {
    const A = replica({ id: 'A' })
    const base = await start({ store: memoryStore([A]) })
    const response = await fetch(`${base}/subscriptions`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ replicas: [A] })
  })

  it('pUT /subscriptions applies desiredStateDiff and persists', async () => {
    const A = replica({ id: 'A', rssUrl: 'https://example.com/a' })
    const APrime = replica({ id: 'A', rssUrl: 'https://example.com/a-prime' })
    const B = replica({ id: 'B', rssUrl: 'https://example.com/b' })
    const C = replica({ id: 'C', rssUrl: 'https://example.com/c' })
    const store = memoryStore([A, C])
    const base = await start({ store })

    const added = await fetch(`${base}/subscriptions`, {
      method: 'PUT',
      headers: {
        'authorization': `Bearer ${TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ replicas: [A, B] }),
    })
    expect(added.status).toBe(200)
    await expect(added.json()).resolves.toEqual({ replicas: [A, B] })
    await expect(store.load()).resolves.toEqual([A, B])

    const replaced = await fetch(`${base}/subscriptions`, {
      method: 'PUT',
      headers: {
        'authorization': `Bearer ${TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ replicas: [APrime] }),
    })
    expect(replaced.status).toBe(200)
    await expect(replaced.json()).resolves.toEqual({ replicas: [APrime] })
  })

  it('pUT /subscriptions rejects a malformed body', async () => {
    const base = await start()
    const response = await fetch(`${base}/subscriptions`, {
      method: 'PUT',
      headers: {
        'authorization': `Bearer ${TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ replica: [] }),
    })
    expect(response.status).toBe(400)
  })

  it('pOST /backfill rejects a malformed body', async () => {
    const base = await start()
    const response = await fetch(`${base}/backfill`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ bangumiId: '3141' }),
    })
    expect(response.status).toBe(400)
  })

  it('pOST /backfill forwards episodes to the ingest hook', async () => {
    const episodes = [
      {
        episodeId: 'a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c',
        title: '[ANi] 葬送的芙莉莲 - 28 [1080P]',
        torrentUrl:
          'https://mikan.example/Download/20240322/a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c.torrent',
      },
    ]
    const onBackfill = async (input: {
      bangumiId: string
      subgroupId: string
      episodes: typeof episodes
    }) => ({ episodes: input.episodes })
    const base = await start({ onBackfill })
    const response = await fetch(`${base}/backfill`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        bangumiId: '3141',
        subgroupId: '583',
        episodes,
      }),
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ episodes })
  })

  it('gET /status returns replicas with empty episode states', async () => {
    const A = replica({ id: 'A' })
    const base = await start({ store: memoryStore([A]) })
    const response = await fetch(`${base}/status`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      replicas: [{ ...A, episodes: [] }],
    })
  })

  it('reloads replicas from the file store after a new process', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tv-helper-'))
    const A = replica({ id: 'A' })
    try {
      const first = createHelperServer({
        config: {
          libraryRoot: '/library',
          qbitUrl: 'http://127.0.0.1:8080',
          qbitUser: 'admin',
          qbitPass: 'pass',
          token: TOKEN,
          port: 17890,
          version: '0.0.1-test',
          pollIntervalMs: 600_000,
        },
        pairingCode: PAIRING_CODE,
        store: createFileReplicaStore(dir),
      })
      server = first
      const firstBase = await listen(first)
      const put = await fetch(`${firstBase}/subscriptions`, {
        method: 'PUT',
        headers: {
          'authorization': `Bearer ${TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ replicas: [A] }),
      })
      expect(put.status).toBe(200)
      await close(first)
      server = undefined

      const second = createHelperServer({
        config: {
          libraryRoot: '/library',
          qbitUrl: 'http://127.0.0.1:8080',
          qbitUser: 'admin',
          qbitPass: 'pass',
          token: TOKEN,
          port: 17890,
          version: '0.0.1-test',
          pollIntervalMs: 600_000,
        },
        pairingCode: PAIRING_CODE,
        store: createFileReplicaStore(dir),
      })
      server = second
      const secondBase = await listen(second)
      const get = await fetch(`${secondBase}/subscriptions`, {
        headers: { authorization: `Bearer ${TOKEN}` },
      })
      expect(get.status).toBe(200)
      await expect(get.json()).resolves.toEqual({ replicas: [A] })
    }
    finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
