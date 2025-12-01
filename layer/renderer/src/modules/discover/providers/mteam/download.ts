import type { MTeamProviderConfig } from '~/atoms/settings/discover'

import type { DiscoverDownloadInfo, DiscoverDownloadParams } from '../../types'
import {
  createHeaders,
  ensureConfigReady,
  handleErrorResponse,
  joinPath,
} from './utils'

export const getDownloadUrl = async (
  params: DiscoverDownloadParams,
  config: MTeamProviderConfig,
): Promise<DiscoverDownloadInfo> => {
  ensureConfigReady(config)

  const endpoint = joinPath(config.baseUrl, '/torrent/genDlToken')
  const body = new URLSearchParams({ id: params.id })
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...createHeaders(config),
    },
    body,
  })

  if (!response.ok) {
    await handleErrorResponse(response)
  }

  const result = (await response.json()) as {
    message?: string
    data?: string
  }

  if (!result.data) {
    throw new Error(result.message || 'M-Team did not return a download link')
  }

  return {
    url: result.data,
    raw: result,
  }
}
