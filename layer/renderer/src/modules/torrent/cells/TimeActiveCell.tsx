import { useCallback, useDeferredValue } from 'react'

import { useTorrentDataStore } from '../stores'

interface TimeActiveCellProps {
  rowIndex: number
}

const selectTorrentTimeActive = (state: any, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return torrent?.time_active || 0
}

export const TimeActiveCell = ({ rowIndex }: TimeActiveCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  const timeActive = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentTimeActive(state, deferredRowIndex),
      [deferredRowIndex],
    ),
  )

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '-'

    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (days > 0) {
      return `${days}d ${hours}h`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  return (
    <div className="flex items-center justify-end px-2 py-4 text-sm text-text tabular-nums">
      {formatDuration(timeActive)}
    </div>
  )
}
