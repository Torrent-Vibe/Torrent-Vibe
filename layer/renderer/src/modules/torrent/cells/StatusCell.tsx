import { useCallback, useDeferredValue } from 'react'
import { useTranslation } from 'react-i18next'

import { useTorrentDataStore } from '../stores'
import { selectTorrentStatus } from '../stores/torrent-selectors'
import { getStatusConfig } from '../utils/status'

interface StatusCellProps {
  rowIndex: number
}

export const StatusCell = ({ rowIndex }: StatusCellProps) => {
  const { t } = useTranslation()
  const deferredRowIndex = useDeferredValue(rowIndex)

  // Use granular selector for just the status data we need
  const state = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentStatus(state, deferredRowIndex).state,
      [deferredRowIndex],
    ),
  )
  const { label: labelKey, className } = getStatusConfig(state)
  const label = t(labelKey)

  return (
    <div
      className={
        'flex items-center px-2 absolute inset-x-2 top-3 justify-center'
      }
    >
      <span
        className={`inline-flex whitespace-pre truncate items-center px-2 py-1 rounded-full text-xs font-medium border ${className}`}
      >
        {label}
      </span>
    </div>
  )
}
