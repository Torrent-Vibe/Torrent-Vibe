import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface RelativeTimeProps {
  /** UNIX timestamp in seconds */
  timestampSeconds: number | null | undefined
  /** Formatting style for Intl.RelativeTimeFormat */
  style?: 'long' | 'short' | 'narrow'
  /** Numeric option for Intl.RelativeTimeFormat */
  numeric?: 'always' | 'auto'
  className?: string
}

type RelativeUnit =
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year'

interface RelativeComputationResult {
  value: number
  unit: RelativeUnit
  nextUpdateInMs: number
}

const SECOND = 1
const MINUTE = 60
const HOUR = 3600
const DAY = 86400
const WEEK = 604800
const MONTH = 2592000 // 30 days (approx.)
const YEAR = 31536000 // 365 days (approx.)

function computeRelative(
  nowMs: number,
  tsSeconds: number,
): RelativeComputationResult {
  const targetMs = tsSeconds * 1000
  const deltaSecondsFloat = (targetMs - nowMs) / 1000
  const deltaSeconds = Math.trunc(deltaSecondsFloat)
  const absSeconds = Math.abs(deltaSeconds)

  let unit: RelativeUnit
  let unitSeconds: number

  if (absSeconds < MINUTE) {
    unit = 'second'
    unitSeconds = SECOND
  } else if (absSeconds < HOUR) {
    unit = 'minute'
    unitSeconds = MINUTE
  } else if (absSeconds < DAY) {
    unit = 'hour'
    unitSeconds = HOUR
  } else if (absSeconds < WEEK) {
    unit = 'day'
    unitSeconds = DAY
  } else if (absSeconds < MONTH) {
    unit = 'week'
    unitSeconds = WEEK
  } else if (absSeconds < YEAR) {
    unit = 'month'
    unitSeconds = MONTH
  } else {
    unit = 'year'
    unitSeconds = YEAR
  }

  const sign = deltaSeconds < 0 ? -1 : 1
  const valueAbs = Math.floor(absSeconds / unitSeconds)
  const value = sign * valueAbs

  // Compute time until the next boundary when the displayed text changes
  // Avoid extremely long timers; clamp to at most one day to keep it responsive on long durations
  const nextBoundaryAbs = (valueAbs + 1) * unitSeconds
  const secondsToNext = Math.max(nextBoundaryAbs - absSeconds, 1)
  const nextUpdateInMs = Math.min(secondsToNext * 1000, DAY * 1000)

  return { value, unit, nextUpdateInMs }
}

export function RelativeTime({
  timestampSeconds,
  style = 'short',
  numeric = 'auto',
  className,
}: RelativeTimeProps) {
  const { i18n } = useTranslation('app')
  const [nowMs, setNowMs] = useState<number>(() => Date.now())

  const isValid = typeof timestampSeconds === 'number' && timestampSeconds > 0

  const { value, unit, nextUpdateInMs } = useMemo(() => {
    if (!isValid) {
      return {
        value: 0,
        unit: 'second' as RelativeUnit,
        nextUpdateInMs: DAY * 1000,
      }
    }
    return computeRelative(nowMs, timestampSeconds as number)
  }, [isValid, nowMs, timestampSeconds])

  useEffect(() => {
    if (!isValid) return
    const id = setTimeout(() => setNowMs(Date.now()), nextUpdateInMs)
    return () => clearTimeout(id)
  }, [isValid, nextUpdateInMs])

  // Re-render when language changes
  useEffect(() => {
    // noop; the hook subscription ensures re-render on language change
  }, [i18n.language])

  const formatter = useMemo(() => {
    try {
      return new Intl.RelativeTimeFormat(i18n.language || 'en', {
        style,
        numeric,
      })
    } catch {
      return new Intl.RelativeTimeFormat('en', { style, numeric })
    }
  }, [i18n.language, numeric, style])

  if (!isValid) return <span className={className}>-</span>

  return <span className={className}>{formatter.format(value, unit)}</span>
}
