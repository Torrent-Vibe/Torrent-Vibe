import { useCallback, useDeferredValue } from 'react'

import { useTorrentDataStore } from '../stores'
import { selectTorrentRatio } from '../stores/torrent-selectors'

interface RatioCellProps {
  rowIndex: number
}

const formatRatio = (ratio: number): string => {
  if (ratio < 0) return '∞'
  return ratio.toFixed(2)
}

export const RatioCell = ({ rowIndex }: RatioCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  // Use granular selector for just the ratio data we need
  const ratio = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentRatio(state, deferredRowIndex).ratio,
      [deferredRowIndex],
    ),
  )

  return (
    <div className="flex items-center justify-end px-2 absolute inset-x-4 top-4">
      <span className="text-sm tabular-nums text-text">
        {formatRatio(ratio)}
      </span>
    </div>
  )
}
