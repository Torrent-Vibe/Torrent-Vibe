import { useCallback, useDeferredValue, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useTorrentDataStore } from '../stores'
import {
  selectTorrentEta,
  selectTorrentStatus,
} from '../stores/torrent-selectors'

interface EtaCellProps {
  rowIndex: number
}

const ETA_INFINITY = 8640000

const useI18nEta = () => {
  const { t } = useTranslation('app')

  const format = useCallback(
    (etaSeconds: number): React.ReactNode => {
      if (etaSeconds === ETA_INFINITY || etaSeconds < 0)
        return t('time.unknown')
      if (etaSeconds === 0) return t('time.done')

      const years = Math.floor(etaSeconds / 31536000)
      const months = Math.floor((etaSeconds % 31536000) / 2592000)
      const days = Math.floor(etaSeconds / 86400)
      const hours = Math.floor((etaSeconds % 86400) / 3600)
      const minutes = Math.floor((etaSeconds % 3600) / 60)

      const y = t('time.units.y')
      const mo = t('time.units.mo')
      const d = t('time.units.d')
      const h = t('time.units.h')
      const m = t('time.units.m')

      if (years > 0) return `${years}${y} ${months}${mo}`
      if (months > 0) return `${months}${mo} ${days}${d}`
      if (days > 0) return `${days}${d} ${hours}${h}`
      if (hours > 0) return `${hours}${h} ${minutes}${m}`
      return `${minutes}${m}`
    },
    [t],
  )

  return format
}

export const EtaCell = ({ rowIndex }: EtaCellProps) => {
  const formatEtaI18n = useI18nEta()
  const deferredRowIndex = useDeferredValue(rowIndex)
  const status = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentStatus(state, deferredRowIndex).state,
      [deferredRowIndex],
    ),
  )

  // Use granular selector for just the ETA data we need
  const eta = useTorrentDataStore(
    useCallback(
      (state) =>
        status === 'pausedUP'
          ? 0
          : selectTorrentEta(state, deferredRowIndex).eta,
      [deferredRowIndex, status],
    ),
  )

  const formattedEta = useMemo(() => {
    return status === 'pausedUP' || status === 'stoppedUP' ? (
      '-'
    ) : eta === ETA_INFINITY ? (
      <i className="i-lucide-infinity" />
    ) : (
      formatEtaI18n(eta)
    )
  }, [eta, status, formatEtaI18n])

  return (
    <div
      className={
        'flex items-center justify-center px-2 absolute inset-x-2 top-4'
      }
    >
      <span className="text-sm tabular-nums text-text">{formattedEta}</span>
    </div>
  )
}
