import { rawFetch, request } from './api'
import { helperEventsResponseSchema } from './schema'
import type { HelperEventsQuery, HelperEventsResponse } from './types'

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
  const parsed = helperEventsResponseSchema.safeParse(body)
  return parsed.success ? parsed.data : { cursor: 0, events: [] }
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
