import type { HelperEvent } from '@torrent-vibe/helper-protocol'

import { rawFetch, request } from './api'
import type { HelperEventsQuery, HelperEventsResponse } from './types'

const parseHelperEvent = (value: unknown): HelperEvent | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  if (
    typeof record.seq !== 'number' ||
    typeof record.at !== 'string' ||
    typeof record.level !== 'string' ||
    typeof record.kind !== 'string' ||
    typeof record.message !== 'string'
  ) {
    return null
  }
  return {
    seq: record.seq,
    at: record.at,
    level: record.level,
    kind: record.kind,
    message: record.message,
    ...(typeof record.replicaId === 'string'
      ? { replicaId: record.replicaId }
      : {}),
    ...(typeof record.bangumiId === 'string'
      ? { bangumiId: record.bangumiId }
      : {}),
    ...(typeof record.subgroupId === 'string'
      ? { subgroupId: record.subgroupId }
      : {}),
    ...(typeof record.episodeId === 'string'
      ? { episodeId: record.episodeId }
      : {}),
    ...(record.fields &&
    typeof record.fields === 'object' &&
    !Array.isArray(record.fields)
      ? { fields: record.fields as Record<string, unknown> }
      : {}),
  }
}

const eventsQueryString = (query?: HelperEventsQuery): string => {
  if (!query) {
    return ''
  }
  const params = new URLSearchParams()
  if (typeof query.since === 'number') {
    params.set('since', String(query.since))
  }
  if (query.level) {
    params.set('level', query.level)
  }
  if (query.replicaId) {
    params.set('replicaId', query.replicaId)
  }
  if (query.kind) {
    params.set('kind', query.kind)
  }
  if (typeof query.limit === 'number') {
    params.set('limit', String(query.limit))
  }
  const search = params.toString()
  return search ? `?${search}` : ''
}

export const getHelperEvents = async (
  baseUrl: string,
  token: string,
  query?: HelperEventsQuery,
): Promise<HelperEventsResponse> => {
  const body = await request(
    baseUrl,
    `/events${eventsQueryString(query)}`,
    { method: 'GET' },
    token,
  )
  if (
    !body ||
    typeof body !== 'object' ||
    !Array.isArray((body as { events?: unknown }).events)
  ) {
    return { events: [], cursor: 0 }
  }
  const record = body as { events: unknown[]; cursor?: unknown }
  return {
    events: record.events
      .map(parseHelperEvent)
      .filter((item): item is HelperEvent => item !== null),
    cursor: typeof record.cursor === 'number' ? record.cursor : 0,
  }
}

export const getHelperLogs = async (
  baseUrl: string,
  token: string,
  tail?: number,
): Promise<string> => {
  const search = typeof tail === 'number' && tail > 0 ? `?tail=${tail}` : ''
  const response = await rawFetch(
    baseUrl,
    `/logs${search}`,
    { method: 'GET', headers: { accept: 'text/plain' } },
    token,
  )
  if (!response.ok) {
    const error = new Error(`helper ${response.status}`)
    ;(error as Error & { status: number }).status = response.status
    throw error
  }
  return response.text()
}

export const checkHelper = async (
  baseUrl: string,
  token: string,
): Promise<void> => {
  await request(baseUrl, '/check', { method: 'POST' }, token)
}
