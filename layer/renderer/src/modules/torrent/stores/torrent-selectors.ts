import type { TorrentStore } from '../types/store'
import { STICKY_FILTER_DURATION } from '../types/store'

/**
 * Centralized selector functions for TorrentStore
 * These functions are stable and can be reused across components
 */

// Hash-based selectors for O(1) lookup by torrent hash
export const selectTorrentByHash = (state: TorrentStore, hash: string) =>
  state.torrentsByHash[hash]

export const selectTorrentsByHash = (state: TorrentStore) =>
  state.torrentsByHash

// Direct access to sorted torrents (computed in store)
export const selectSortedTorrents = (state: TorrentStore) =>
  state.sortedTorrents

// UI-reactive selectors (for useTorrentDataStore subscriptions)
export const selectTorrentsLength = (state: TorrentStore) =>
  state.sortedTorrents.length

export const selectHeaderCheckboxState = (state: TorrentStore) => {
  const { selectedTorrents, sortedTorrents } = state
  return {
    isAllSelected: selectedTorrents.length === sortedTorrents.length,
    isIndeterminate:
      selectedTorrents.length > 0 &&
      selectedTorrents.length < sortedTorrents.length,
  }
}

export const selectSortState = (state: TorrentStore) => ({
  sortKey: state.sortKey,
  sortDirection: state.sortDirection,
})

export const selectSelectedTorrents = (state: TorrentStore) =>
  state.selectedTorrents

export const selectSelectedTorrentsCount = (state: TorrentStore) =>
  state.selectedTorrents.length

export const selectFilterState = (state: TorrentStore) => state.filterState

export const selectCategories = (state: TorrentStore) => state.categories

export const selectTags = (state: TorrentStore) => state.tags

export const selectServerState = (state: TorrentStore) => state.serverState

// Selector for getting torrent by row index (use with useMemo in components)
export const selectTorrentByIndex = (state: TorrentStore, rowIndex: number) =>
  state.sortedTorrents[rowIndex]

// Cell-level selectors for individual torrent properties
export const selectTorrentName = (state: TorrentStore, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return {
    name: torrent?.name || '',
    category: torrent?.category || '',
    tags: torrent?.tags || '',
    hash: torrent?.hash || '',
  }
}

export const selectTorrentProgress = (
  state: TorrentStore,
  rowIndex: number,
) => {
  const torrent = state.sortedTorrents[rowIndex]
  return {
    progress: torrent?.progress || 0,
    state: torrent?.state || '',
    size: torrent?.size || 0,
    completed: torrent?.completed || 0,
  }
}

export const selectTorrentSpeed = (
  state: TorrentStore,
  rowIndex: number,
  speedType: 'dlspeed' | 'upspeed',
) => {
  const torrent = state.sortedTorrents[rowIndex]
  return torrent?.[speedType] || 0
}

export const selectTorrentStatus = (state: TorrentStore, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return {
    state: torrent?.state || '',
    progress: torrent?.progress || 0,
  }
}

export const selectTorrentSize = (state: TorrentStore, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return {
    size: torrent?.size || 0,
    completed: torrent?.completed || 0,
  }
}

export const selectTorrentEta = (state: TorrentStore, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return {
    eta: torrent?.eta || 0,
    state: torrent?.state || '',
    dlspeed: torrent?.dlspeed || 0,
  }
}

export const selectTorrentRatio = (state: TorrentStore, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return {
    ratio: torrent?.ratio || 0,
    uploaded: torrent?.uploaded || 0,
    downloaded: torrent?.downloaded || 0,
  }
}

export const selectTorrentCategory = (state: TorrentStore, rowIndex: number) =>
  state.sortedTorrents[rowIndex]?.category || ''

export const selectTorrentTags = (state: TorrentStore, rowIndex: number) =>
  state.sortedTorrents[rowIndex]?.tags || ''

export const selectTorrentAddedOn = (state: TorrentStore, rowIndex: number) =>
  state.sortedTorrents[rowIndex]?.added_on || 0

export const selectTorrentLastActivity = (
  state: TorrentStore,
  rowIndex: number,
) => state.sortedTorrents[rowIndex]?.last_activity || 0

export const selectTorrentTimeActive = (
  state: TorrentStore,
  rowIndex: number,
) => state.sortedTorrents[rowIndex]?.time_active || 0

export const selectTorrentSeedingTime = (
  state: TorrentStore,
  rowIndex: number,
) => state.sortedTorrents[rowIndex]?.seeding_time || 0

export const selectTorrentPriority = (state: TorrentStore, rowIndex: number) =>
  state.sortedTorrents[rowIndex]?.priority || 0

export const selectTorrentPeers = (state: TorrentStore, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return {
    num_leechs: torrent?.num_leechs || 0,
    num_incomplete: torrent?.num_incomplete || 0,
  }
}

export const selectTorrentSeeds = (state: TorrentStore, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return {
    num_seeds: torrent?.num_seeds || 0,
    num_complete: torrent?.num_complete || 0,
  }
}

export const selectTorrentSavePath = (state: TorrentStore, rowIndex: number) =>
  state.sortedTorrents[rowIndex]?.save_path || ''

export const selectTorrentTracker = (state: TorrentStore, rowIndex: number) =>
  state.sortedTorrents[rowIndex]?.tracker || ''

export const selectTorrentUploaded = (state: TorrentStore, rowIndex: number) =>
  state.sortedTorrents[rowIndex]?.uploaded || 0

export const selectTorrentDownloaded = (
  state: TorrentStore,
  rowIndex: number,
) => state.sortedTorrents[rowIndex]?.downloaded || 0

export const selectTorrentRemaining = (state: TorrentStore, rowIndex: number) =>
  state.sortedTorrents[rowIndex]?.amount_left || 0

export const selectTorrentCompletion = (
  state: TorrentStore,
  rowIndex: number,
) => {
  const torrent = state.sortedTorrents[rowIndex]
  return {
    completion_on: torrent?.completion_on || 0,
    progress: torrent?.progress || 0,
    state: torrent?.state || '',
  }
}

// Selection state selectors
export const selectTorrentSelectionState = (
  state: TorrentStore,
  rowIndex: number,
) => {
  const torrent = state.sortedTorrents[rowIndex]
  return torrent ? state.selectedTorrents.includes(torrent.hash) : false
}

// Selection data for checkbox (includes hash and selection state)
export const selectTorrentSelectionData = (
  state: TorrentStore,
  rowIndex: number,
) => {
  const torrent = state.sortedTorrents[rowIndex]
  return {
    hash: torrent?.hash || '',
    isSelected: torrent ? state.selectedTorrents.includes(torrent.hash) : false,
  }
}

// Utility function to get torrent hash from sorted position
export const selectTorrentHashByIndex = (
  state: TorrentStore,
  rowIndex: number,
) => state.sortedTorrents[rowIndex]?.hash

// Sticky filter selectors
export const selectStickyFilterEntries = (state: TorrentStore) =>
  state.stickyFilterEntries

// Check if a torrent is in sticky filter state
export const selectIsTorrentSticky = (
  state: TorrentStore,
  hash: string,
): boolean => {
  const now = Date.now()
  return state.stickyFilterEntries.some(
    (entry) =>
      entry.hash === hash && now - entry.operationTime < STICKY_FILTER_DURATION,
  )
}

// Get sticky status for a torrent by row index
export const selectTorrentStickyStatusByIndex = (
  state: TorrentStore,
  rowIndex: number,
) => {
  const torrent = state.sortedTorrents[rowIndex]
  if (!torrent) return { isSticky: false, remainingTime: 0 }

  const now = Date.now()
  const stickyEntry = state.stickyFilterEntries.find(
    (entry) => entry.hash === torrent.hash,
  )

  if (!stickyEntry) return { isSticky: false, remainingTime: 0 }

  const elapsed = now - stickyEntry.operationTime
  const remainingTime = Math.max(0, STICKY_FILTER_DURATION - elapsed)

  return {
    isSticky: remainingTime > 0,
    remainingTime,
    operationTime: stickyEntry.operationTime,
  }
}
