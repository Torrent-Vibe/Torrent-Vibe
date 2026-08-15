import type { BangumiCard } from '@torrent-vibe/mikan'
import {
  joinMikanUrl,
  parseSearchBangumi,
  parseSeasonWall,
} from '@torrent-vibe/mikan'

import type { MikanProviderConfig } from '~/atoms/settings/discover'

import type {
  DiscoverItem,
  DiscoverSearchParams,
  DiscoverSearchResponse,
} from '../../types'
import {
  ensureConfigReady,
  handleErrorResponse,
  resolveSeasonWallQuery,
} from './utils'

const fetchHtml = async (url: string, signal?: AbortSignal) => {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    await handleErrorResponse(response)
  }
  return response.text()
}

const toBangumiItem = (card: BangumiCard, weekday?: number): DiscoverItem => ({
  id: card.bangumiId,
  providerId: 'mikan',
  title: card.title,
  extra: {
    kind: 'bangumi',
    weekday: card.weekday ?? weekday,
    coverUrl: card.coverUrl,
  },
})

export const search = async (
  params: DiscoverSearchParams,
  config: MikanProviderConfig,
): Promise<DiscoverSearchResponse> => {
  ensureConfigReady(config)

  const keyword = params.keyword?.trim() ?? ''
  const page = Math.max(params.page ?? 1, 1)
  const pageSize = Math.max(params.pageSize ?? config.pageSize ?? 50, 1)

  if (keyword) {
    const url = joinMikanUrl(
      config.baseUrl,
      `Home/Search?searchstr=${encodeURIComponent(keyword)}`,
    )
    const html = await fetchHtml(url, params.signal)
    const items = parseSearchBangumi(html).map(card => toBangumiItem(card))

    return {
      items,
      total: items.length,
      page: 1,
      pageSize,
      hasMore: false,
    }
  }

  const { year, season } = resolveSeasonWallQuery(params.filters)
  const url = joinMikanUrl(
    config.baseUrl,
    `Home/BangumiCoverFlowByDayOfWeek?year=${year}&seasonStr=${encodeURIComponent(season)}`,
  )
  const html = await fetchHtml(url, params.signal)
  const wall = parseSeasonWall(html)
  const items = wall.groups.flatMap(group =>
    group.items.map(card => toBangumiItem(card, group.weekday)))

  return {
    items,
    total: items.length,
    page,
    pageSize,
    hasMore: false,
  }
}
