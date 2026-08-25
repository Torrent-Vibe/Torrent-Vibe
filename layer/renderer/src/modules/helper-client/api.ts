import type {
  HelperReplica,
  HelperSubscriptionSnapshot,
} from '@torrent-vibe/helper-protocol'

import {
  helperConfigPublicSchema,
  helperDiscoverSchema,
  helperPairResultSchema,
  helperProfileSnapshotSchema,
  helperStatusResponseSchema,
  helperSubscriptionSnapshotSchema,
  parseOrThrow,
} from './schema'
import type {
  HelperBackfillInput,
  HelperConfigPatch,
  HelperConfigPublic,
  HelperDiscoverInfo,
  HelperProfileMutation,
  HelperProfileSnapshot,
  HelperStatusResponse,
} from './types'

export const normalizeHelperBaseUrl = (url: string): string =>
  url.trim().replace(/\/+$/, '')

export const sameHostDiscoverUrl = (hostname: string, port = 17890): string =>
  `http://${hostname}:${port}`

const jsonHeaders = {
  accept: 'application/json',
  'content-type': 'application/json',
}

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  if (!text.trim()) {
    return null
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export const rawFetch = (
  baseUrl: string,
  path: string,
  init: RequestInit,
  token?: string,
): Promise<Response> => {
  const headers = new Headers(init.headers)
  if (token) {
    headers.set('authorization', `Bearer ${token}`)
  }
  return fetch(`${normalizeHelperBaseUrl(baseUrl)}${path}`, {
    ...init,
    headers,
  })
}

export const request = async (
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
  const response = await rawFetch(baseUrl, path, { ...init, headers }, token)
  const body = await readJson(response)
  if (!response.ok) {
    const error = new Error(`helper ${response.status}`)
    ;(error as Error & { status: number; body: unknown }).status =
      response.status
    ;(error as Error & { status: number; body: unknown }).body = body
    throw error
  }
  return body
}

export const discoverHelper = async (
  baseUrl: string,
): Promise<HelperDiscoverInfo> =>
  parseOrThrow(
    helperDiscoverSchema,
    await request(baseUrl, '/discover', { method: 'GET' }),
    'invalid discover payload',
  )

const parseProfileSnapshot = (body: unknown): HelperProfileSnapshot =>
  parseOrThrow(helperProfileSnapshotSchema, body, 'invalid profile payload')

export const getHelperProfile = async (
  baseUrl: string,
  token: string,
): Promise<HelperProfileSnapshot> => {
  const body = await request(baseUrl, '/profile', { method: 'GET' }, token)
  return parseProfileSnapshot(body)
}

export const patchHelperProfile = async (
  baseUrl: string,
  token: string,
  revision: number,
  mutations: HelperProfileMutation[],
): Promise<HelperProfileSnapshot> => {
  const body = await request(
    baseUrl,
    '/profile',
    {
      method: 'PATCH',
      body: JSON.stringify({ revision, mutations }),
    },
    token,
  )
  return parseProfileSnapshot(body)
}

export const pairHelper = async (
  baseUrl: string,
  code: string,
  clientId: string,
  clientName: string,
): Promise<{ clientId: string; token: string }> => {
  const body = await request(baseUrl, '/pair', {
    method: 'POST',
    body: JSON.stringify({ clientId, clientName, code }),
  })
  const parsed = parseOrThrow(
    helperPairResultSchema,
    body,
    'invalid pair payload',
  )
  return {
    clientId: parsed.clientId ?? clientId,
    token: parsed.token,
  }
}

const parseSubscriptionSnapshot = (body: unknown): HelperSubscriptionSnapshot =>
  parseOrThrow(
    helperSubscriptionSnapshotSchema,
    body,
    'invalid subscriptions payload',
  )

export const getHelperSubscriptions = async (
  baseUrl: string,
  token: string,
): Promise<HelperSubscriptionSnapshot> => {
  const body = await request(
    baseUrl,
    '/subscriptions',
    { method: 'GET' },
    token,
  )
  return parseSubscriptionSnapshot(body)
}

export const putHelperSubscriptions = async (
  baseUrl: string,
  token: string,
  replicas: HelperReplica[],
  revision: number,
  options?: { deleteFiles?: boolean; removeTorrents?: boolean },
): Promise<HelperSubscriptionSnapshot> => {
  const body = await request(
    baseUrl,
    '/subscriptions',
    {
      method: 'PUT',
      body: JSON.stringify(
        options?.removeTorrents
          ? {
              replicas,
              revision,
              removeTorrents: true,
              deleteFiles: options.deleteFiles === true,
            }
          : { replicas, revision },
      ),
    },
    token,
  )
  return parseSubscriptionSnapshot(body)
}

export const getHelperStatus = async (
  baseUrl: string,
  token: string,
  signal?: AbortSignal,
): Promise<HelperStatusResponse> =>
  parseOrThrow(
    helperStatusResponseSchema,
    await request(baseUrl, '/status', { method: 'GET', signal }, token),
    'invalid status payload',
  )

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
): Promise<HelperConfigPublic> =>
  parseOrThrow(
    helperConfigPublicSchema,
    await request(baseUrl, '/config', { method: 'GET' }, token),
    'invalid config payload',
  )

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
