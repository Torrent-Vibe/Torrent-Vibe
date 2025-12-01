import { useCallback, useDeferredValue } from 'react'

import { formatBytes } from '~/lib/format'

import { useTorrentDataStore } from '../stores'

interface DownloadedCellProps {
  rowIndex: number
}

const selectTorrentDownloaded = (state: any, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return torrent?.downloaded || 0
}

export const DownloadedCell = ({ rowIndex }: DownloadedCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  const downloaded = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentDownloaded(state, deferredRowIndex),
      [deferredRowIndex],
    ),
  )

  return (
    <div className="flex items-center justify-end px-2 py-4 text-sm text-text tabular-nums">
      {formatBytes(downloaded)}
    </div>
  )
}
