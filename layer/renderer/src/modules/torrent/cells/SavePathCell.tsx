import { useCallback, useDeferredValue } from 'react'

import { useTorrentDataStore } from '../stores'

interface SavePathCellProps {
  rowIndex: number
}

const selectTorrentSavePath = (state: any, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return torrent?.save_path || ''
}

export const SavePathCell = ({ rowIndex }: SavePathCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  const savePath = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentSavePath(state, deferredRowIndex),
      [deferredRowIndex],
    ),
  )

  const getShortPath = (path: string) => {
    if (!path) return '-'
    const parts = path.split(/[/\\]/)
    if (parts.length <= 2) return path
    return `.../${parts.slice(-2).join('/')}`
  }

  return (
    <div className="flex items-center px-2 py-4 text-sm text-text">
      <span title={savePath} className="truncate">
        {getShortPath(savePath)}
      </span>
    </div>
  )
}
