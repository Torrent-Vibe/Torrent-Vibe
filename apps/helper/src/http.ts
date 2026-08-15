import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { createServer } from 'node:http'

import type { HelperReplica } from '@torrent-vibe/helper-protocol'
import { desiredStateDiff } from '@torrent-vibe/helper-protocol'
import type { RssEpisode } from '@torrent-vibe/mikan'

import type { HelperConfig } from './config'
import type { BackfillInput } from './loop'
import type { ReplicaStore } from './store'

export interface HelperServerOptions {
  config: Omit<HelperConfig, 'dataDir'>
  pairingCode: string
  store: ReplicaStore
  onBackfill?: (input: BackfillInput) => Promise<unknown>
}

const MAX_BODY_BYTES = 1024 * 1024

export function applyDesiredReplicas(
  current: HelperReplica[],
  desired: HelperReplica[],
): HelperReplica[] {
  let next = current
  for (const op of desiredStateDiff(desired, current)) {
    next
      = op.type === 'remove'
        ? next.filter(replica => replica.id !== op.id)
        : [...next, op.replica]
  }
  return next
}

export function createHelperServer(options: HelperServerOptions): Server {
  const { config, pairingCode, store, onBackfill } = options
  let bound = false

  return createServer((req, res) => {
    void handleRequest(req, res).catch(() => {
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'internal' })
        return
      }
      res.destroy()
    })
  })

  async function handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const method = req.method ?? 'GET'
    const path = url.pathname

    if (method === 'GET' && path === '/discover') {
      sendJson(res, 200, {
        version: config.version,
        bindState: bound ? 'bound' : 'unbound',
        advertisedQbitUrl: config.qbitUrl,
        pairingCode,
        port: config.port,
      })
      return
    }

    if (method === 'POST' && path === '/pair') {
      const body = await readJson(req, res)
      if (body === undefined) {
        return
      }
      const code = readStringField(body, 'code')
      if (!code || !safeEqual(code, pairingCode)) {
        sendJson(res, 403, { error: 'forbidden' })
        return
      }
      bound = true
      sendJson(res, 200, { token: config.token })
      return
    }

    if (!authorize(req, config.token)) {
      sendJson(res, 401, { error: 'unauthorized' })
      return
    }

    if (method === 'GET' && path === '/subscriptions') {
      sendJson(res, 200, { replicas: await store.load() })
      return
    }

    if (method === 'PUT' && path === '/subscriptions') {
      const body = await readJson(req, res)
      if (body === undefined) {
        return
      }
      if (
        !body
        || typeof body !== 'object'
        || !Array.isArray((body as { replicas?: unknown }).replicas)
      ) {
        sendJson(res, 400, { error: 'invalid body' })
        return
      }
      const desired = (body as { replicas: HelperReplica[] }).replicas
      const next = applyDesiredReplicas(await store.load(), desired)
      await store.save(next)
      sendJson(res, 200, { replicas: next })
      return
    }

    if (method === 'GET' && path === '/status') {
      const replicas = await store.load()
      const episodes = await store.loadEpisodes()
      sendJson(res, 200, {
        replicas: replicas.map(replica => ({
          ...replica,
          episodes: episodes[replica.id] ?? [],
        })),
      })
      return
    }

    if (method === 'POST' && path === '/backfill') {
      const body = await readJson(req, res)
      if (body === undefined) {
        return
      }
      const input = readBackfill(body)
      if (!input) {
        sendJson(res, 400, { error: 'invalid body' })
        return
      }
      const result = onBackfill ? await onBackfill(input) : { episodes: [] }
      sendJson(res, 200, result)
      return
    }

    sendJson(res, 404, { error: 'not found' })
  }
}

function authorize(req: IncomingMessage, token: string): boolean {
  const header = req.headers.authorization
  if (!header) {
    return false
  }
  const match = /^Bearer (.+)$/.exec(header)
  return Boolean(match && safeEqual(match[1]!, token))
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) {
    return false
  }
  return timingSafeEqual(a, b)
}

function readBackfill(body: unknown): BackfillInput | undefined {
  if (!body || typeof body !== 'object') {
    return undefined
  }
  const record = body as {
    bangumiId?: unknown
    subgroupId?: unknown
    episodes?: unknown
  }
  if (
    typeof record.bangumiId !== 'string'
    || typeof record.subgroupId !== 'string'
    || !Array.isArray(record.episodes)
  ) {
    return undefined
  }
  const episodes: RssEpisode[] = []
  for (const item of record.episodes) {
    if (!item || typeof item !== 'object') {
      return undefined
    }
    const episode = item as Record<string, unknown>
    if (
      typeof episode.episodeId !== 'string'
      || typeof episode.title !== 'string'
      || typeof episode.torrentUrl !== 'string'
    ) {
      return undefined
    }
    const parsed: RssEpisode = {
      episodeId: episode.episodeId,
      title: episode.title,
      torrentUrl: episode.torrentUrl,
    }
    if (typeof episode.publishedAt === 'string') {
      parsed.publishedAt = episode.publishedAt
    }
    if (typeof episode.sizeBytes === 'number') {
      parsed.sizeBytes = episode.sizeBytes
    }
    episodes.push(parsed)
  }
  return {
    bangumiId: record.bangumiId,
    subgroupId: record.subgroupId,
    episodes,
  }
}

function readStringField(body: unknown, key: string): string | undefined {
  if (!body || typeof body !== 'object' || !(key in body)) {
    return undefined
  }
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

async function readJson(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<unknown | undefined> {
  try {
    const raw = await readBody(req)
    if (!raw.trim()) {
      return {}
    }
    return JSON.parse(raw) as unknown
  }
  catch {
    sendJson(res, 400, { error: 'invalid json' })
    return undefined
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        req.destroy()
        reject(new Error('payload too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}
