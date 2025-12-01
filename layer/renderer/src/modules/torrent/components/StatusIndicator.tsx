import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { Spring } from '~/lib/spring'

interface FilterStat {
  label: string
  count: number
  icon: string
  color: string
}

interface StatusIndicatorProps {
  isLoading: boolean
  currentFilterStat: FilterStat
  totalStats: number
  isFilteredView: boolean
}

export const StatusIndicator = ({
  isLoading,
  currentFilterStat,
  totalStats,
  isFilteredView,
}: StatusIndicatorProps) => {
  const { t } = useTranslation()

  return (
    <m.div
      className="flex items-center gap-3 text-sm"
      layout
      transition={Spring.presets.smooth}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-text-secondary">
          <i className="i-mingcute-loading-3-line animate-spin" />
          {t('torrent.loading')}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <i
            className={`${currentFilterStat.icon} ${currentFilterStat.color}`}
          />
          <span className="font-medium text-text">
            {currentFilterStat.count} {currentFilterStat.label.toLowerCase()}
          </span>
          {totalStats > 0 && isFilteredView && (
            <span className="text-text-tertiary">
              {t('torrent.statusIndicator.of', { total: totalStats })}
            </span>
          )}
        </div>
      )}
    </m.div>
  )
}
