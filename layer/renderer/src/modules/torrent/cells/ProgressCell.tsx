import { useCallback, useDeferredValue } from 'react'

import { useTorrentDataStore } from '../stores'
import { selectTorrentProgress } from '../stores/torrent-selectors'

interface ProgressCellProps {
  rowIndex: number
}

export const ProgressCell = ({ rowIndex }: ProgressCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  // Use granular selector for just the progress data we need
  const progress = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentProgress(state, deferredRowIndex).progress,
      [deferredRowIndex],
    ),
  )

  const percentage = useDeferredValue(
    Number.parseFloat((progress * 100).toFixed(2)),
  )

  return (
    <div className={'px-2 absolute inset-0 flex top-4'}>
      <div className="relative w-full h-4 bg-gray9/20 rounded-full overflow-hidden">
        {/* Progress bar fill */}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent to-accent/80 transition-all duration-300 ease-out rounded-full"
          style={{ width: `${percentage}%` }}
        />

        {/* Background text (visible in unfilled area) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-text-secondary">
            {percentage}%
          </span>
        </div>

        {/* Foreground text (visible in filled area, clipped) */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            clipPath: `inset(0 ${100 - percentage}% 0 0)`,
            transition: 'clip-path 300ms ease-out',
          }}
        >
          <span className="text-xs font-medium text-white">{percentage}%</span>
        </div>
      </div>
    </div>
  )
}
