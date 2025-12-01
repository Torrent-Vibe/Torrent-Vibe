import { useCallback, useDeferredValue } from 'react'

import { useTorrentDataStore } from '../stores'

interface PeersCellProps {
  rowIndex: number
}

const selectTorrentPeers = (state: any, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return {
    num_leechs: torrent?.num_leechs || 0,
    num_incomplete: torrent?.num_incomplete || 0,
  }
}

export const PeersCell = ({ rowIndex }: PeersCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  const { num_leechs, num_incomplete } = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentPeers(state, deferredRowIndex),
      [deferredRowIndex],
    ),
  )

  return (
    <div className="flex items-center justify-center px-2 py-2 text-sm text-text tabular-nums">
      <span>
        {num_leechs}
        {num_incomplete !== undefined && num_incomplete !== num_leechs && (
          <span className="text-text-secondary"> ({num_incomplete})</span>
        )}
      </span>
    </div>
  )
}
