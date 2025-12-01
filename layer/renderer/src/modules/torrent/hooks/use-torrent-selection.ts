import { useCallback } from 'react'

import { useSetDetailPanelVisible } from '~/modules/detail/atoms'

import { getTorrentTableActions } from '../stores/torrent-table-store'

/**
 * Hook for managing torrent selection and detail panel interaction
 */
export const useTorrentSelection = () => {
  const { setActiveTorrentHash } = getTorrentTableActions()
  const setDetailPanelVisible = useSetDetailPanelVisible()

  const selectTorrent = useCallback(
    (torrentHash: string | null) => {
      setActiveTorrentHash(torrentHash)
      if (torrentHash) {
        setDetailPanelVisible(true)
      }
    },
    [setActiveTorrentHash, setDetailPanelVisible],
  )

  const clearSelection = useCallback(() => {
    setActiveTorrentHash(null)
  }, [setActiveTorrentHash])

  const selectAndShowDetail = useCallback(
    (torrentHash: string) => {
      setActiveTorrentHash(torrentHash)
      setDetailPanelVisible(true)
    },
    [setActiveTorrentHash, setDetailPanelVisible],
  )

  return {
    selectTorrent,
    clearSelection,
    selectAndShowDetail,
  }
}
