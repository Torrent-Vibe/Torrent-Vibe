import { useCallback, useDeferredValue } from 'react'

import { useTorrentDataStore } from '../stores'

interface TrackerCellProps {
  rowIndex: number
}

const selectTorrentTracker = (state: any, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return torrent?.tracker || ''
}

export const TrackerCell = ({ rowIndex }: TrackerCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  const tracker = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentTracker(state, deferredRowIndex),
      [deferredRowIndex],
    ),
  )

  const getTrackerDomain = (url: string) => {
    if (!url) return '-'
    try {
      const domain = new URL(url).hostname
      return domain.replace(/^www\./, '')
    } catch {
      return url.length > 20 ? `${url.slice(0, 17)}...` : url
    }
  }

  return (
    <div className="flex items-center px-2 py-4 text-sm text-text truncate">
      <span title={tracker}>{getTrackerDomain(tracker)}</span>
    </div>
  )
}
