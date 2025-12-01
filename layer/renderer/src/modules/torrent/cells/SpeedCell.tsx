import { useCallback, useDeferredValue } from 'react'

import { formatSpeedWithStatus } from '~/lib/format'

import { useTorrentDataStore } from '../stores'
import { selectTorrentSpeed } from '../stores/torrent-selectors'

interface SpeedCellProps {
  rowIndex: number
  speedType: 'dlspeed' | 'upspeed'
}

export const SpeedCell = ({ rowIndex, speedType }: SpeedCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  // Use granular selector for just the speed data we need
  const speed = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentSpeed(state, deferredRowIndex, speedType),
      [deferredRowIndex, speedType],
    ),
  )
  const { text, colorClass } = formatSpeedWithStatus(speed)

  return (
    <div className={'flex items-center justify-end absolute inset-x-2 top-4'}>
      <span className={`text-sm tabular-nums ${colorClass}`}>{text}</span>
    </div>
  )
}
