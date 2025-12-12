import type { MTeamProviderConfig } from '~/atoms/settings/discover'

import type { DiscoverSearchParams, DiscoverSearchResponse } from '../../types'
import { mapSearchItemToDiscoverItem } from './mappers'
import type { MTeamSearchPayload, MTeamSearchResponseBody } from './types'
import {
  createHeaders,
  ensureConfigReady,
  handleErrorResponse,
  joinPath,
  parseCategories,
  parseNumber,
} from './utils'

const buildSearchPayload = (
  params: DiscoverSearchParams,
  config: MTeamProviderConfig,
): MTeamSearchPayload => {
  const page = Math.max(params.page ?? 1, 1)
  const pageSize = Math.max(
    1,
    Math.min(params.pageSize ?? config.pageSize ?? 20, 100),
  )
  const filters = params.filters ?? {}
  const categories = parseCategories(filters.categories)
  const mode =
    (typeof filters.mode === 'string' && filters.mode.trim()) ||
    config.mode ||
    'normal'
  const discount =
    typeof filters.discount === 'string' ? filters.discount : undefined

  const payload: MTeamSearchPayload = {
    keyword: params.keyword?.trim() || undefined,
    categories,
    pageNumber: page,
    pageSize,
    mode,
    visible: 1,
  }

  if (discount && discount !== 'any') {
    payload.discount = discount
  }

  return payload
}

export const search = async (
  params: DiscoverSearchParams,
  config: MTeamProviderConfig,
): Promise<DiscoverSearchResponse> => {
  ensureConfigReady(config)

  const payload = buildSearchPayload(params, config)
  const endpoint = joinPath(config.baseUrl, '/torrent/search')
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...createHeaders(config),
    },
    body: JSON.stringify(payload),
    signal: params.signal,
  })

  if (!response.ok) {
    await handleErrorResponse(response)
  }

  const data = (await response.json()) as MTeamSearchResponseBody
  const list = Array.isArray(data.data.data) ? data.data.data : []

  const items = list.map((item) => mapSearchItemToDiscoverItem(item))
  const total = parseNumber(data.data.total)

  const page = Math.max(payload.pageNumber, 1)

  const { pageSize, totalPages } = data.data

  const hasMore = page < totalPages

  return {
    items,
    total,
    totalPages,
    page,
    pageSize,
    hasMore,
    raw: data,
  }
}

export { type MTeamSearchPayload } from './types'
