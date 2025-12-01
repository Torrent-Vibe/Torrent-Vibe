import { useCallback, useDeferredValue } from 'react'

import { formatBytes } from '~/lib/format'

import { useTorrentDataStore } from '../stores'

interface RemainingCellProps {
  rowIndex: number
}

const selectTorrentRemaining = (state: any, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return torrent?.amount_left || 0
}

export const RemainingCell = ({ rowIndex }: RemainingCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  const remaining = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentRemaining(state, deferredRowIndex),
      [deferredRowIndex],
    ),
  )

  return (
    <div className="flex items-center justify-end px-2 py-2 text-sm text-text tabular-nums">
      {remaining > 0 ? formatBytes(remaining) : '-'}
    </div>
  )
}
