import { joinMikanUrl, parseBangumiDetail } from '@torrent-vibe/mikan'

import type { MikanProviderConfig } from '~/atoms/settings/discover'

import type {
  DiscoverDownloadParams,
  DiscoverItem,
  DiscoverItemDetail,
} from '../../types'
import {
  asMikanBangumiExtra,
  ensureConfigReady,
  handleErrorResponse,
} from './utils'

export const getItemDetail = async (
  params: DiscoverDownloadParams,
  config: MikanProviderConfig,
): Promise<DiscoverItemDetail> => {
  ensureConfigReady(config)

  const bangumiId = params.id
  const url = joinMikanUrl(config.baseUrl, `Home/Bangumi/${bangumiId}`)
  const response = await fetch(url)
  if (!response.ok) {
    await handleErrorResponse(response)
  }

  const html = await response.text()
  const detail = parseBangumiDetail(html, bangumiId, config.baseUrl)
  const previous = asMikanBangumiExtra(params.item?.extra)

  const baseItem: DiscoverItem = params.item ?? {
    id: bangumiId,
    providerId: 'mikan',
    title: detail.title || 'Unknown title',
  }

  return {
    ...baseItem,
    id: bangumiId,
    providerId: 'mikan',
    title: detail.title || baseItem.title,
    extra: {
      kind: 'bangumi',
      weekday: previous?.weekday,
      coverUrl: detail.coverUrl ?? previous?.coverUrl,
      bangumiSubjectId: detail.bangumiSubjectId,
      subgroups: detail.subgroups,
      episodes: detail.episodes,
    },
    raw: detail,
  }
}
