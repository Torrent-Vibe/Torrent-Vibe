import type { HelperStatusResponse } from '../helper-client'
import {
  clearHelperBinding,
  getHelperBinding,
  getHelperStatus,
  isHelperAuthError,
  resolveCurrentServerId,
} from '../helper-client'

type DeleteTorrents = (input: {
  deleteFiles: boolean
  hashes: string[]
  serverId: string
}) => Promise<void>

type LoadHelperStatus = (
  serverId: string,
  signal?: AbortSignal,
) => Promise<HelperStatusResponse | null>

const leftoverHashes = (
  status: HelperStatusResponse,
  bangumiId: string,
  subgroupId: string,
): string[] => {
  const hashes: string[] = []
  for (const job of status.jobs) {
    if (job.bangumiId !== bangumiId || job.subgroupId !== subgroupId) {
      continue
    }
    for (const episode of job.episodes) {
      if (episode.infohash) {
        hashes.push(episode.infohash)
      }
    }
  }
  return hashes
}

export const dropLeftoverTorrents = async (input: {
  bangumiId: string
  deleteFiles: boolean
  deleteTorrents: DeleteTorrents
  loadHelperStatus: LoadHelperStatus
  serverIds: string[]
  subgroupId: string
}): Promise<boolean> => {
  let allOk = true
  for (const serverId of new Set(input.serverIds.filter(Boolean))) {
    try {
      const status = await input.loadHelperStatus(serverId)
      if (!status) {
        continue
      }
      const hashes = leftoverHashes(status, input.bangumiId, input.subgroupId)
      if (hashes.length === 0) {
        continue
      }
      await input.deleteTorrents({
        serverId,
        hashes,
        deleteFiles: input.deleteFiles,
      })
    } catch {
      allOk = false
    }
  }
  return allOk
}

export const liveLoadHelperStatus = async (
  serverId: string,
  signal?: AbortSignal,
): Promise<HelperStatusResponse | null> => {
  const binding = getHelperBinding(serverId)
  if (!binding) {
    return null
  }
  try {
    return await getHelperStatus(binding.url, binding.token, signal)
  } catch (error) {
    if (isHelperAuthError(error)) {
      clearHelperBinding(serverId)
    }
    throw error
  }
}

export const liveDeleteTorrents = async (input: {
  deleteFiles: boolean
  hashes: string[]
  serverId: string
}) => {
  const { QBittorrentClient } = await import('~/shared/api/qbittorrent-client')
  if (input.serverId === resolveCurrentServerId()) {
    await QBittorrentClient.shared.removeTorrent(
      input.hashes,
      input.deleteFiles,
    )
    return
  }
  const { loadMultiServerConfig, loadServerPassword } =
    await import('../multi-server/utils/server-config')
  const server = loadMultiServerConfig().servers.find(
    (item) => item.id === input.serverId,
  )
  if (!server) {
    throw new Error('noServer')
  }
  const password =
    (await loadServerPassword(input.serverId)) ?? server.config.password ?? ''
  const client = QBittorrentClient.create({ ...server.config, password })
  await client.login()
  await client.removeTorrent(input.hashes, input.deleteFiles)
}
