import type { ServerState, TorrentInfo } from '~/types/torrent'

import { useTorrentDataStore } from '../stores/torrent-data-store'
import { useTorrentTableSelectors } from '../stores/torrent-table-store'
import type { NetworkStats, TorrentStats } from '../types/store'
import { countTorrentStatusGroups } from '../utils/status-grouping'

// Utility functions
const calculateStats = (torrents: TorrentInfo[]): TorrentStats =>
  countTorrentStatusGroups(torrents)

// Custom hooks for computed values using precise selectors
export const useTorrentStats = (): TorrentStats => {
  return useTorrentDataStore((state) => calculateStats(state.torrents))
}

export const useHasSelection = (): boolean => {
  return useTorrentDataStore((state) => state.selectedTorrents.length > 0)
}

// Network statistics computation
const calculateNetworkStats = (
  torrents: TorrentInfo[],
  serverState: ServerState | null,
): NetworkStats => {
  // Calculate fallback speeds from torrents if server state doesn't have real-time data
  const calculatedDownloadSpeed = torrents.reduce(
    (sum, torrent) => sum + (torrent.dlspeed || 0),
    0,
  )
  const calculatedUploadSpeed = torrents.reduce(
    (sum, torrent) => sum + (torrent.upspeed || 0),
    0,
  )

  // Prefer server state speeds (from maindata) over calculated speeds for accuracy
  // Server state from maindata API has real-time dl_info_speed and up_info_speed
  return {
    globalDownloadSpeed: serverState?.dl_info_speed ?? calculatedDownloadSpeed,
    globalUploadSpeed: serverState?.up_info_speed ?? calculatedUploadSpeed,
    downloadLimit: serverState?.dl_rate_limit ?? -1,
    uploadLimit: serverState?.up_rate_limit ?? -1,
    connectionStatus: serverState?.connection_status ?? 'unknown',
  }
}

// Network statistics hooks
export const useNetworkStats = (): NetworkStats => {
  return useTorrentDataStore((state) =>
    calculateNetworkStats(state.torrents, state.serverState),
  )
}

export const useServerState = () => {
  return useTorrentDataStore((state) => state.serverState)
}

export const useGlobalSpeeds = (): {
  downloadSpeed: number
  uploadSpeed: number
} => {
  return useTorrentDataStore((state) => {
    const networkStats = calculateNetworkStats(
      state.torrents,
      state.serverState,
    )
    return {
      downloadSpeed: networkStats.globalDownloadSpeed,
      uploadSpeed: networkStats.globalUploadSpeed,
    }
  })
}

export const useActiveTorrent = (): TorrentInfo | null => {
  const activeTorrentHash = useTorrentTableSelectors.useActiveTorrentHash()
  return useTorrentDataStore((state) => {
    if (!activeTorrentHash) return null
    return (
      state.torrents.find((torrent) => torrent.hash === activeTorrentHash) ??
      null
    )
  })
}

export const useGlobalTotalData = (): {
  totalDownloaded: number
  totalUploaded: number
  freeSpaceOnDisk: number
} => {
  return useTorrentDataStore((state) => ({
    totalDownloaded: state.serverState?.dl_info_data ?? 0,
    totalUploaded: state.serverState?.up_info_data ?? 0,
    freeSpaceOnDisk: state.serverState?.free_space_on_disk ?? 0,
  }))
}
