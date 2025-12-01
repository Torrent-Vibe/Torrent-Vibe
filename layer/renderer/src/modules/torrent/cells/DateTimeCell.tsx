import { useCallback, useDeferredValue, useEffect, useState } from 'react'

import { Tooltip } from '~/components/ui/tooltip'
import { TooltipContent, TooltipTrigger } from '~/components/ui/tooltip/Tooltip'
import { RelativeTime } from '~/components/ui/typography'
import { getI18n } from '~/i18n'

import { useTorrentDataStore } from '../stores'

interface DateTimeCellProps {
  rowIndex: number
  field: 'added_on' | 'completion_on' | 'last_activity'
  format?: 'datetime' | 'relative'
  /** When format is 'relative', show absolute time after this many days */
  relativeMaxDays?: number
}

const selectTorrentDateTime = (state: any, rowIndex: number, field: string) => {
  const torrent = state.sortedTorrents[rowIndex]
  return torrent?.[field] || 0
}

export const DateTimeCell = ({
  rowIndex,
  field,
  format = 'datetime',
  relativeMaxDays = 14,
}: DateTimeCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  const timestamp = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentDateTime(state, deferredRowIndex, field),
      [deferredRowIndex, field],
    ),
  )

  // When relativeMaxDays is provided, switch to absolute after threshold
  const [_thresholdTick, setThresholdTick] = useState(0)
  const thresholdSeconds =
    typeof relativeMaxDays === 'number' && relativeMaxDays > 0
      ? relativeMaxDays * 86400
      : null

  const shouldShowAbsoluteForRelative = (() => {
    if (format !== 'relative' || !thresholdSeconds) return false
    if (!timestamp) return false
    const nowSec = Date.now() / 1000
    const ageSec = nowSec - timestamp
    return ageSec >= thresholdSeconds
  })()

  useEffect(() => {
    if (format !== 'relative' || !thresholdSeconds || !timestamp) return
    const nowSec = Date.now() / 1000
    const ageSec = nowSec - timestamp
    const remainingSec = thresholdSeconds - ageSec
    if (remainingSec <= 0) return
    const id = setTimeout(
      () => setThresholdTick((n) => n + 1),
      remainingSec * 1000,
    )
    return () => clearTimeout(id)
  }, [format, thresholdSeconds, timestamp])

  if (timestamp < 0) return null

  return (
    <div className="flex items-center justify-end px-2 top-4 absolute inset-x-0 text-sm text-text">
      <Tooltip>
        <TooltipTrigger>
          {format === 'relative' && !shouldShowAbsoluteForRelative ? (
            <RelativeTime
              className="tabular-nums"
              timestampSeconds={timestamp}
            />
          ) : (
            <span className="tabular-nums">
              {formatDateTime(timestamp, true)}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent>{formatDateTime(timestamp, false)}</TooltipContent>
      </Tooltip>
    </div>
  )
}

const formatDateTime = (timestamp: number, simple?: boolean) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp * 1000)

  return Intl.DateTimeFormat(getI18n().language, {
    timeStyle: simple ? 'short' : 'long',
    dateStyle: simple ? 'short' : 'long',
  }).format(date)
}
