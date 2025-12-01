import { useCallback, useDeferredValue } from 'react'

import { formatBytesSmart } from '~/lib/format'

import { useTorrentDataStore } from '../stores'
import { selectTorrentSize } from '../stores/torrent-selectors'

interface SizeCellProps {
  rowIndex: number
}

// moved to ~/lib/format as formatBytesSmart

export const SizeCell = ({ rowIndex }: SizeCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  // Use granular selector for just the size data we need
  const size = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentSize(state, deferredRowIndex).size,
      [deferredRowIndex],
    ),
  )

  return (
    <div
      className={'flex items-center justify-end px-2 absolute inset-x-0 top-4'}
    >
      <span className="text-sm tabular-nums text-text">
        {formatBytesSmart(size)}
      </span>
    </div>
  )
}
