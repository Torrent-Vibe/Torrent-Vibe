import type { MikanProviderConfig } from '~/atoms/settings/discover'

import type { DiscoverDownloadInfo, DiscoverDownloadParams } from '../../types'
import { getItemDetail } from './detail'
import { ensureConfigReady, findEpisodeTorrentUrl } from './utils'

export const getDownloadUrl = async (
  params: DiscoverDownloadParams,
  config: MikanProviderConfig,
): Promise<DiscoverDownloadInfo> => {
  ensureConfigReady(config)

  const fromItem = findEpisodeTorrentUrl(params.item?.extra, params.id)
  if (fromItem) {
    return { url: fromItem }
  }

  const bangumiId
    = typeof params.item?.id === 'string' && params.item.id !== params.id
      ? params.item.id
      : null

  if (!bangumiId) {
    throw new Error('Mikan episode download requires bangumi detail')
  }

  const detail = await getItemDetail(
    { id: bangumiId, item: params.item },
    config,
  )
  const fromDetail = findEpisodeTorrentUrl(detail.extra, params.id)
  if (!fromDetail) {
    throw new Error('Mikan episode torrent URL was not found')
  }

  return { url: fromDetail, raw: detail.raw }
}
