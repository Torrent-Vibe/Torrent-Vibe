import type { HelperReplica } from '@torrent-vibe/helper-protocol'

import type {
  HelperBackfillInput,
  HelperConfigPatch,
  HelperConfigPublic,
  HelperDiscoverInfo,
  HelperEpisodeStatus,
  HelperJobStatus,
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

const parseEpisodes = (value: unknown): HelperEpisodeStatus[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((entry) => {
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
        episode: typeof episode.episode === 'number' ? episode.episode : null,
        state:
          typeof episode.state === 'string'
            ? (episode.state as HelperEpisodeStatus['state'])
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
    episodes: parseEpisodes(record.episodes),
  }
}

const parseJobStatus = (value: unknown): HelperJobStatus | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  if (
    typeof record.bangumiId !== 'string'
    || typeof record.subgroupId !== 'string'
  ) {
    return null
  }
  return {
    bangumiId: record.bangumiId,
    subgroupId: record.subgroupId,
    episodes: parseEpisodes(record.episodes),
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
  const record = body as { replicas: unknown[], jobs?: unknown }
  const replicas = record.replicas
    .map(parseReplicaStatus)
    .filter((item): item is HelperReplicaStatus => item !== null)
  const jobs = Array.isArray(record.jobs)
    ? record.jobs
        .map(parseJobStatus)
        .filter((item): item is HelperJobStatus => item !== null)
    : []
  return { replicas, jobs }
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

export const unpairHelper = async (
  baseUrl: string,
  token: string,
): Promise<void> => {
  await request(baseUrl, '/unpair', { method: 'POST' }, token)
}

export const getHelperConfig = async (
  baseUrl: string,
  token: string,
): Promise<HelperConfigPublic> => {
  const body = await request(baseUrl, '/config', { method: 'GET' }, token)
  if (!body || typeof body !== 'object') {
    throw new Error('invalid config payload')
  }
  const record = body as Record<string, unknown>
  return {
    libraryRoot:
      typeof record.libraryRoot === 'string' ? record.libraryRoot : '',
    category: typeof record.category === 'string' ? record.category : 'Bangumi',
    qbitUrl: typeof record.qbitUrl === 'string' ? record.qbitUrl : '',
    qbitUser: typeof record.qbitUser === 'string' ? record.qbitUser : '',
    hasQbitPass: record.hasQbitPass === true,
    pollIntervalMs:
      typeof record.pollIntervalMs === 'number'
        ? record.pollIntervalMs
        : 600_000,
  }
}

export const putHelperConfig = async (
  baseUrl: string,
  token: string,
  patch: HelperConfigPatch,
): Promise<HelperConfigPublic> => {
  await request(
    baseUrl,
    '/config',
    { method: 'PUT', body: JSON.stringify(patch) },
    token,
  )
  return getHelperConfig(baseUrl, token)
}

export const retryHelperEpisode = async (
  baseUrl: string,
  token: string,
  input: {
    bangumiId: string
    subgroupId: string
    episodeId: string
    title?: string
    torrentUrl?: string
  },
): Promise<unknown> =>
  request(
    baseUrl,
    '/retry',
    { method: 'POST', body: JSON.stringify(input) },
    token,
  )
