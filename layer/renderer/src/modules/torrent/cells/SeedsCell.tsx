import { useCallback, useDeferredValue } from 'react'

import { useTorrentDataStore } from '../stores'

interface SeedsCellProps {
  rowIndex: number
}

const selectTorrentSeeds = (state: any, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return {
    num_seeds: torrent?.num_seeds || 0,
    num_complete: torrent?.num_complete || 0,
  }
}

export const SeedsCell = ({ rowIndex }: SeedsCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  const { num_seeds, num_complete } = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentSeeds(state, deferredRowIndex),
      [deferredRowIndex],
    ),
  )

  return (
    <div className="flex items-center justify-center px-2 py-4 text-sm text-text tabular-nums">
      <span>
        {num_seeds}
        {num_complete !== undefined && num_complete !== num_seeds && (
          <span className="text-text-secondary"> ({num_complete})</span>
        )}
      </span>
    </div>
  )
}
