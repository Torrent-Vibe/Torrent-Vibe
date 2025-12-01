import { useCallback } from 'react'

import type { TorrentInfo } from '~/types/torrent'

import { torrentDataStoreSetters } from '../stores'

/**
 * Hook for managing torrent table interactions (selection, row clicks, etc.)
 */
export const useTorrentTableInteractions = () => {
  const handleSelectionChange = useCallback(
    (hash: string, selected: boolean) => {
      torrentDataStoreSetters.toggleTorrentSelectionById(hash, selected)
    },
    [],
  )

  const handleSelectAll = useCallback(
    (torrents: TorrentInfo[], selected: boolean) => {
      if (selected) {
        torrentDataStoreSetters.selectTorrents(torrents.map((t) => t.hash))
      } else {
        torrentDataStoreSetters.clearSelection()
      }
    },
    [],
  )

  return {
    handleSelectionChange,
    handleSelectAll,
  }
}
