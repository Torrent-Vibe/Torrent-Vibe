import { useCallback, useDeferredValue } from 'react'

import { useTorrentDataStore } from '../stores'

interface PriorityCellProps {
  rowIndex: number
}

const selectTorrentPriority = (state: any, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return torrent?.priority || 0
}

export const PriorityCell = ({ rowIndex }: PriorityCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  const priority = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentPriority(state, deferredRowIndex),
      [deferredRowIndex],
    ),
  )

  const getPriorityText = (priority: number) => {
    switch (priority) {
      case 0: {
        return 'Normal'
      }
      case 1: {
        return 'High'
      }
      case 2: {
        return 'Maximum'
      }
      case -1: {
        return 'Low'
      }
      case -2: {
        return 'Minimum'
      }
      default: {
        return priority.toString()
      }
    }
  }

  return (
    <div className="flex items-center justify-center px-2 py-2 text-sm text-text">
      {getPriorityText(priority)}
    </div>
  )
}
