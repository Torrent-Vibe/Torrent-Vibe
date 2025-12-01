import type { Torrent } from '@innei/qbittorrent-browser'
import { toast } from 'sonner'

import { getI18n } from '~/i18n'
import { QBittorrentClient } from '~/shared/api/qbittorrent-client'
import type { TransferInfo } from '~/shared/types/qbittorrent'
import type { ServerState, TorrentInfo } from '~/types/torrent'

import {
  torrentDataStoreSetters,
  useTorrentDataStore,
} from './torrent-data-store'

// Utility function to convert library Torrent to our TorrentInfo
const mapTorrentToTorrentInfo = (torrent: Torrent): TorrentInfo => ({
  ...torrent,
  auto_tmm: false,
  availability: -1,
  content_path: '',
  force_start: false,
  seeding_time: 0,
  last_activity: torrent.last_activity || 0,
  seen_complete: torrent.seen_complete || -1,
  seq_dl: torrent.seq_dl || false,
  super_seeding: false,
  time_active: 0,
  // eslint-disable-next-line unicorn/explicit-length-check
  total_size: torrent.total_size || torrent.size,
  tracker: '',
  isPrivate: false,
  amount_left:
    torrent.size > 0
      ? Math.max(0, torrent.size - torrent.progress * torrent.size)
      : 0,
  completed: torrent.progress * torrent.size,
  completion_on: torrent.completion_on || -1,
  downloaded: torrent.downloaded || 0,
  downloaded_session: torrent.downloaded_session || 0,
  uploaded: torrent.uploaded || 0,
  uploaded_session: torrent.uploaded_session || 0,
  dl_limit: torrent.dl_limit || -1,
  up_limit: torrent.up_limit || -1,
  max_ratio: -1,
  max_seeding_time: -1,
  num_complete: torrent.num_complete || -1,
  num_incomplete: torrent.num_incomplete || -1,
  ratio_limit: -1,
  save_path: torrent.save_path || '',
  seeding_time_limit: -1,
  f_l_piece_prio: false,
  magnet_uri: torrent.magnet_uri || '',
})

const defaultTorrentInfo: TorrentInfo = {
  hash: '',
  name: '',
  size: 0,
  progress: 0,
  dlspeed: 0,
  upspeed: 0,
  priority: 0,
  num_seeds: 0,
  num_leechs: 0,
  ratio: 0,
  eta: 0,
  state: 'unknown',
  category: '',
  tags: '',
  added_on: 0,
  completion_on: -1,
  last_activity: 0,
  dl_limit: -1,
  up_limit: -1,
  downloaded: 0,
  uploaded: 0,
  downloaded_session: 0,
  uploaded_session: 0,
  amount_left: 0,
  auto_tmm: false,
  availability: -1,
  completed: 0,
  content_path: '',
  f_l_piece_prio: false,
  force_start: false,
  magnet_uri: '',
  max_ratio: -1,
  max_seeding_time: -1,
  num_complete: -1,
  num_incomplete: -1,
  ratio_limit: -1,
  save_path: '',
  seeding_time: 0,
  seeding_time_limit: -1,
  seen_complete: -1,
  seq_dl: false,
  super_seeding: false,
  time_active: 0,
  total_size: 0,
  tracker: '',
  isPrivate: false,
}

// Utility function to convert MainData.torrents to TorrentInfo array
const mapMainDataTorrentsToTorrentInfo = (
  torrents: Record<string, Partial<TorrentInfo>>,
): TorrentInfo[] => {
  return Object.entries(torrents).map(([hash, torrentData]) => {
    // Ensure required fields are present with defaults

    // Merge with provided data
    return { ...defaultTorrentInfo, ...torrentData, hash }
  })
}

export class TorrentActions {
  private constructor() {}

  public static shared = new TorrentActions()

  // Access store state
  private get state() {
    return useTorrentDataStore.getState()
  }

  async fetchTorrents(): Promise<TorrentInfo[]> {
    const result = await QBittorrentClient.shared.listTorrents()
    const torrents = result.map((torrent) => mapTorrentToTorrentInfo(torrent))

    torrentDataStoreSetters.setTorrents(torrents)
    torrentDataStoreSetters.updateLastFetched()

    return torrents
  }

  async fetchTransferInfo(): Promise<TransferInfo> {
    const { ...result } = await QBittorrentClient.shared.requestTransferInfo()

    torrentDataStoreSetters.setServerState({
      ...this.state.serverState!,
      ...result,
    })
    return result
  }

  async fetchTorrentsAndServerState(signal?: AbortSignal): Promise<{
    torrents: TorrentInfo[]
    serverState: ServerState | null
  }> {
    // Fetch main data which includes both torrents and server state in a single API call
    const mainData = await QBittorrentClient.shared.requestMainData()

    if (signal?.aborted) {
      return { torrents: [], serverState: null }
    }

    // Convert torrents from MainData format to TorrentInfo array
    const torrents = mapMainDataTorrentsToTorrentInfo(mainData.torrents || {})

    torrentDataStoreSetters.setTorrents(torrents)
    torrentDataStoreSetters.setServerState(mainData.server_state)
    torrentDataStoreSetters.updateLastFetched()

    return { torrents, serverState: mainData.server_state }
  }

  async pauseTorrents(hashes?: string[]): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents

    if (targetHashes.length === 0) return

    try {
      // Optimistic update
      useTorrentDataStore.setState((state) => {
        targetHashes.forEach((hash) => {
          const torrent = state.torrents.find((t) => t.hash === hash)
          if (
            torrent &&
            !['pausedDL', 'stoppedDL', 'stoppedUP'].includes(torrent.state)
          ) {
            torrent.state = 'pausedDL'
          }
        })
      })

      await QBittorrentClient.shared.stopTorrent(targetHashes)

      // Add torrents to sticky filter to keep them visible in current view
      torrentDataStoreSetters.addStickyFilterEntries(targetHashes)

      // Show success feedback
      const { t } = getI18n()
      toast.success(
        t('messages.torrentsPaused', { count: targetHashes.length }),
      )
    } catch (error) {
      console.error('Failed to pause torrents:', error)
    }
  }

  async resumeTorrents(hashes?: string[]): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents

    if (targetHashes.length === 0) return

    try {
      // Optimistic update
      useTorrentDataStore.setState((state) => {
        targetHashes.forEach((hash) => {
          const torrent = state.torrents.find((t) => t.hash === hash)
          if (
            torrent &&
            ['pausedDL', 'stoppedDL', 'stoppedUP'].includes(torrent.state)
          ) {
            torrent.state = torrent.progress < 1 ? 'downloading' : 'uploading'
          }
        })
      })

      await QBittorrentClient.shared.startTorrent(targetHashes)

      // Add torrents to sticky filter to keep them visible in current view
      torrentDataStoreSetters.addStickyFilterEntries(targetHashes)

      // Show success feedback
      const { t } = getI18n()
      toast.success(
        t('messages.torrentsResumed', { count: targetHashes.length }),
      )
    } catch (error) {
      console.error('Failed to resume torrents:', error)
    }
  }

  async deleteTorrents(hashes?: string[], deleteFiles = false): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents

    if (targetHashes.length === 0) return

    try {
      // Optimistic update - remove from local state
      useTorrentDataStore.setState((state) => {
        state.torrents = state.torrents.filter(
          (t) => !targetHashes.includes(t.hash),
        )
      })

      await QBittorrentClient.shared.removeTorrent(targetHashes, deleteFiles)
      // Clear selection after delete since torrents no longer exist
      torrentDataStoreSetters.clearSelection()
    } catch (error) {
      console.error('Failed to delete torrents:', error)
    }
  }

  async fetchCategories(): Promise<void> {
    try {
      const categories = await QBittorrentClient.shared.requestCategories()
      torrentDataStoreSetters.setCategories(categories)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  async addTorrent(
    options: Parameters<typeof QBittorrentClient.shared.requestAddTorrent>[0],
  ): Promise<void> {
    await QBittorrentClient.shared.requestAddTorrent(options)
  }

  async forceResumeTorrents(hashes?: string[]): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents
    if (targetHashes.length === 0) return

    try {
      // Use force start API which is specifically designed for forcing torrents to start
      await QBittorrentClient.shared.requestSetForceStart(targetHashes, true)

      // Add torrents to sticky filter to keep them visible in current view
      torrentDataStoreSetters.addStickyFilterEntries(targetHashes)

      // Show success feedback
      const { t } = getI18n()
      toast.success(
        t('messages.torrentsForceResumed', { count: targetHashes.length }),
      )
      // Refresh data
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to force resume torrents:', error)
    }
  }

  async setTorrentLocation(
    hashes?: string[],
    location?: string,
  ): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents
    if (targetHashes.length === 0 || !location) return

    try {
      await QBittorrentClient.shared.setTorrentLocation(targetHashes, location)
      // Don't clear selection to maintain user context
      // Refresh data
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to set torrent location:', error)
    }
  }

  async renameTorrent(hash: string, newName: string): Promise<void> {
    try {
      await QBittorrentClient.shared.setTorrentName(hash, newName)
      // Refresh data
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to rename torrent:', error)
    }
  }

  async renameFile(
    hash: string,
    oldPath: string,
    newPath: string,
  ): Promise<void> {
    try {
      await QBittorrentClient.shared.renameFile(hash, oldPath, newPath)
      // Refresh data
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to rename file:', error)
    }
  }

  async setTorrentCategory(
    hashes?: string[],
    category?: string,
  ): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents
    if (targetHashes.length === 0) return

    try {
      await QBittorrentClient.shared.setTorrentCategory(targetHashes, category)
      // Don't clear selection to maintain user context
      // Refresh data
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to set torrent category:', error)
    }
  }

  async addTorrentTags(hashes?: string[], tags?: string[]): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents
    if (targetHashes.length === 0 || !tags || tags.length === 0) return

    try {
      await QBittorrentClient.shared.addTorrentTags(
        targetHashes,
        tags.join(','),
      )
      // Don't clear selection to maintain user context
      // Refresh data
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to add torrent tags:', error)
    }
  }

  async removeTorrentTags(hashes?: string[], tags?: string[]): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents
    if (targetHashes.length === 0) return

    try {
      const tagsToRemove = tags && tags.length > 0 ? tags.join(',') : undefined
      await QBittorrentClient.shared.removeTorrentTags(
        targetHashes,
        tagsToRemove,
      )
      // Don't clear selection to maintain user context
      // Refresh data
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to remove torrent tags:', error)
    }
  }

  async setTorrentDownloadLimit(
    hashes?: string[],
    limit?: number,
  ): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents
    if (targetHashes.length === 0 || limit === undefined) return

    try {
      await QBittorrentClient.shared.setTorrentDownloadLimit(
        targetHashes,
        limit,
      )
      // Don't clear selection to maintain user context
      // Refresh data
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to set torrent download limit:', error)
    }
  }

  async setTorrentUploadLimit(
    hashes?: string[],
    limit?: number,
  ): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents
    if (targetHashes.length === 0 || limit === undefined) return

    try {
      await QBittorrentClient.shared.setTorrentUploadLimit(targetHashes, limit)
      // Don't clear selection to maintain user context
      // Refresh data
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to set torrent upload limit:', error)
    }
  }

  async recheckTorrents(hashes?: string[]): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents
    if (targetHashes.length === 0) return

    try {
      await QBittorrentClient.shared.recheckTorrent(targetHashes)
      // Don't clear selection to maintain user context
      // Refresh data
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to recheck torrents:', error)
    }
  }

  async reannounceTorrents(hashes?: string[]): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents
    if (targetHashes.length === 0) return

    try {
      await QBittorrentClient.shared.reannounceTorrent(targetHashes)
      // Don't clear selection to maintain user context
      // Refresh data
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to reannounce torrents:', error)
    }
  }

  async copyMagnetLink(hash: string): Promise<void> {
    try {
      const torrent = this.state.torrents.find((t) => t.hash === hash)
      if (torrent?.magnet_uri) {
        await navigator.clipboard?.writeText(torrent.magnet_uri)
      }
    } catch (error) {
      console.error('Failed to copy magnet link:', error)
    }
  }

  async setSuperSeeding(hashes?: string[], enabled?: boolean): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents
    if (targetHashes.length === 0 || enabled === undefined) return

    try {
      await QBittorrentClient.shared.requestSetSuperSeeding(
        targetHashes,
        enabled,
      )
      // Don't clear selection to maintain user context
      // Refresh data
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to set super seeding:', error)
    }
  }

  async toggleSequentialDownload(hashes?: string[]): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents
    if (targetHashes.length === 0) return

    try {
      await QBittorrentClient.shared.requestToggleSequentialDownload(
        targetHashes,
      )
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to toggle sequential download:', error)
    }
  }

  async toggleFirstLastPiecePriority(hashes?: string[]): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents
    if (targetHashes.length === 0) return

    try {
      await QBittorrentClient.shared.requestToggleFirstLastPiecePriority(
        targetHashes,
      )
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to toggle first/last piece priority:', error)
    }
  }

  async setShareLimits(
    hashes?: string[],
    ratioLimit?: number,
    seedingTimeLimit?: number,
    inactiveSeedingTimeLimit?: number,
  ): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents
    if (targetHashes.length === 0) return

    try {
      await QBittorrentClient.shared.requestSetShareLimits(
        targetHashes,
        ratioLimit,
        seedingTimeLimit,
        inactiveSeedingTimeLimit,
      )
      // Don't clear selection to maintain user context
      // Refresh data
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to set share limits:', error)
    }
  }

  async setAutoManagement(hashes?: string[], enabled?: boolean): Promise<void> {
    const targetHashes = hashes || this.state.selectedTorrents
    if (targetHashes.length === 0 || enabled === undefined) return

    try {
      await QBittorrentClient.shared.requestSetAutoManagement(
        targetHashes,
        enabled,
      )
      // Don't clear selection to maintain user context
      // Refresh data
      await this.fetchTorrents()
    } catch (error) {
      console.error('Failed to set auto management:', error)
    }
  }
}
