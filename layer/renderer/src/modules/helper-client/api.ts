import type { HelperReplica } from '@torrent-vibe/helper-protocol'

import type {
  HelperBackfillInput,
  HelperDiscoverInfo,
  HelperReplicaStatus,
  HelperStatusResponse,
} from './types'

export const normalizeHelperBaseUrl = (url: string): string =>
  url.trim().replace(/\/+$/, '')

export const sameHostDiscoverUrl = (hostname: string, port = 17890): string =>
  `http://${hostname}:${port}`

const jsonHeaders = {
  'accept': 'application/json',
  'content-type': 'application/json',
}

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  if (!text.trim()) {
    return null
  }
  return JSON.parse(text) as unknown
}

const request = async (
  baseUrl: string,
  path: string,
  init: RequestInit,
  token?: string,
): Promise<unknown> => {
  const headers = new Headers(init.headers)
  if (!headers.has('accept')) {
    headers.set('accept', jsonHeaders.accept)
  }
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', jsonHeaders['content-type'])
  }
  if (token) {
    headers.set('authorization', `Bearer ${token}`)
  }
  const response = await fetch(`${normalizeHelperBaseUrl(baseUrl)}${path}`, {
    ...init,
    headers,
  })
  const body = await readJson(response)
  if (!response.ok) {
    const error = new Error(`helper ${response.status}`)
    ;(error as Error & { status: number, body: unknown }).status
      = response.status
    ;(error as Error & { status: number, body: unknown }).body = body
    throw error
  }
  return body
}

export const discoverHelper = async (
  baseUrl: string,
): Promise<HelperDiscoverInfo> => {
  const body = await request(baseUrl, '/discover', { method: 'GET' })
  if (!body || typeof body !== 'object') {
    throw new Error('invalid discover payload')
  }
  const record = body as Record<string, unknown>
  return {
    version: typeof record.version === 'string' ? record.version : '',
    bindState:
      typeof record.bindState === 'string' ? record.bindState : 'unbound',
    advertisedQbitUrl:
      typeof record.advertisedQbitUrl === 'string'
        ? record.advertisedQbitUrl
        : '',
    pairingCode:
      typeof record.pairingCode === 'string' ? record.pairingCode : '',
    port: typeof record.port === 'number' ? record.port : 17890,
  }
}

export const pairHelper = async (
  baseUrl: string,
  code: string,
): Promise<{ token: string }> => {
  const body = await request(baseUrl, '/pair', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
  if (
    !body
    || typeof body !== 'object'
    || typeof (body as { token?: unknown }).token !== 'string'
  ) {
    throw new Error('invalid pair payload')
  }
  return { token: (body as { token: string }).token }
}

export const getHelperSubscriptions = async (
  baseUrl: string,
  token: string,
): Promise<HelperReplica[]> => {
  const body = await request(
    baseUrl,
    '/subscriptions',
    { method: 'GET' },
    token,
  )
  if (
    !body
    || typeof body !== 'object'
    || !Array.isArray((body as { replicas?: unknown }).replicas)
  ) {
    throw new Error('invalid subscriptions payload')
  }
  return (body as { replicas: HelperReplica[] }).replicas
}

export const putHelperSubscriptions = async (
  baseUrl: string,
  token: string,
  replicas: HelperReplica[],
): Promise<HelperReplica[]> => {
  const body = await request(
    baseUrl,
    '/subscriptions',
    {
      method: 'PUT',
      body: JSON.stringify({ replicas }),
    },
    token,
  )
  if (
    !body
    || typeof body !== 'object'
    || !Array.isArray((body as { replicas?: unknown }).replicas)
  ) {
    throw new Error('invalid subscriptions payload')
  }
  return (body as { replicas: HelperReplica[] }).replicas
}

const parseReplicaStatus = (value: unknown): HelperReplicaStatus | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  if (
    typeof record.id !== 'string'
    || typeof record.bangumiId !== 'string'
    || typeof record.title !== 'string'
    || typeof record.subgroupId !== 'string'
    || typeof record.subgroupName !== 'string'
    || typeof record.rssUrl !== 'string'
  ) {
    return null
  }
  const episodes = Array.isArray(record.episodes)
    ? record.episodes.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') {
          return []
        }
        const episode = entry as Record<string, unknown>
        if (
          typeof episode.episodeId !== 'string'
          || typeof episode.title !== 'string'
        ) {
          return []
        }
        return [
          {
            episodeId: episode.episodeId,
            title: episode.title,
            season: typeof episode.season === 'number' ? episode.season : null,
            episode:
              typeof episode.episode === 'number' ? episode.episode : null,
            state:
              typeof episode.state === 'string'
                ? (episode.state as HelperReplicaStatus['episodes'][number]['state'])
                : 'pending',
            ...(typeof episode.infohash === 'string'
              ? { infohash: episode.infohash }
              : {}),
            ...(typeof episode.lastError === 'string'
              ? { lastError: episode.lastError }
              : {}),
          },
        ]
      })
    : []
  return {
    id: record.id,
    bangumiId: record.bangumiId,
    title: record.title,
    ...(typeof record.bangumiSubjectId === 'string'
      ? { bangumiSubjectId: record.bangumiSubjectId }
      : {}),
    subgroupId: record.subgroupId,
    subgroupName: record.subgroupName,
    rssUrl: record.rssUrl,
    episodes,
  }
}

export const getHelperStatus = async (
  baseUrl: string,
  token: string,
): Promise<HelperStatusResponse> => {
  const body = await request(baseUrl, '/status', { method: 'GET' }, token)
  if (
    !body
    || typeof body !== 'object'
    || !Array.isArray((body as { replicas?: unknown }).replicas)
  ) {
    throw new Error('invalid status payload')
  }
  return {
    replicas: (body as { replicas: unknown[] }).replicas.map(parseReplicaStatus).filter((item): item is HelperReplicaStatus => item !== null),
  }
}

export const backfillHelper = async (
  baseUrl: string,
  token: string,
  input: HelperBackfillInput,
): Promise<unknown> =>
  request(
    baseUrl,
    '/backfill',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    token,
  )

export const isHelperAuthError = (error: unknown): boolean => {
  const status = (error as { status?: number } | null)?.status
  return status === 401 || status === 403
}
