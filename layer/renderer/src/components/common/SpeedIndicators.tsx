import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, XAxis, YAxis } from 'recharts'

import {
  HoverCard,
  HoverCardArrow,
  HoverCardContent,
  HoverCardTrigger,
} from '~/components/ui/hover-card'
import { formatBytes, formatSpeedWithStatus } from '~/lib/format'
import {
  useGlobalSpeeds,
  useGlobalTotalData,
} from '~/modules/torrent/hooks/use-torrent-computed'

interface SpeedIndicatorsProps {
  variant?: 'compact' | 'standard'
  showTotalData?: boolean
}

const SPEED_HISTORY_LENGTH = 60

interface SpeedHistory {
  download: number[]
  upload: number[]
}

const sanitizeSpeedValue = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) return 0
  return value
}

const normalizeSeriesLength = (series: number[], length: number): number[] => {
  if (series.length === length) return series
  if (series.length > length) {
    return series.slice(series.length - length)
  }
  return [...Array.from({ length: length - series.length }, () => 0), ...series]
}

const useSpeedHistory = (
  downloadSpeed: number,
  uploadSpeed: number,
  length = SPEED_HISTORY_LENGTH,
): SpeedHistory => {
  const [history, setHistory] = useState<SpeedHistory>(() => ({
    download: Array.from({ length }, () => 0),
    upload: Array.from({ length }, () => 0),
  }))
  const latestSpeedsRef = useRef({
    download: sanitizeSpeedValue(downloadSpeed),
    upload: sanitizeSpeedValue(uploadSpeed),
  })

  useEffect(() => {
    latestSpeedsRef.current = {
      download: sanitizeSpeedValue(downloadSpeed),
      upload: sanitizeSpeedValue(uploadSpeed),
    }
  }, [downloadSpeed, uploadSpeed])

  useEffect(() => {
    setHistory((prev) => {
      const downloadSeries = normalizeSeriesLength(prev.download, length)
      const uploadSeries = normalizeSeriesLength(prev.upload, length)

      return {
        download: [
          ...downloadSeries.slice(1),
          sanitizeSpeedValue(downloadSpeed),
        ],
        upload: [...uploadSeries.slice(1), sanitizeSpeedValue(uploadSpeed)],
      }
    })
  }, [downloadSpeed, uploadSpeed, length])

  useEffect(() => {
    const interval = setInterval(() => {
      setHistory((prev) => {
        const downloadSeries = normalizeSeriesLength(prev.download, length)
        const uploadSeries = normalizeSeriesLength(prev.upload, length)

        return {
          download: [
            ...downloadSeries.slice(1),
            latestSpeedsRef.current.download,
          ],
          upload: [...uploadSeries.slice(1), latestSpeedsRef.current.upload],
        }
      })
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [length])

  return history
}

interface SpeedSparklineProps {
  data: number[]
  colorClass: string
  ariaLabel: string
}

const SpeedSparkline = ({
  data,
  colorClass,
  ariaLabel,
}: SpeedSparklineProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const measure = () => {
      const width = Math.floor(element.getBoundingClientRect().width)
      setContainerWidth((prev) => (prev !== width ? width : prev))
    }

    measure()

    let resizeObserver: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(measure)
      resizeObserver.observe(element)
    }

    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      resizeObserver?.disconnect()
    }
  }, [])

  const chartData = data.map((value, index) => ({
    index,
    value: sanitizeSpeedValue(value),
  }))
  const maxValue = chartData.reduce(
    (max, point) => Math.max(point.value, max),
    0,
  )
  const yDomainMax = maxValue > 0 ? maxValue : 1

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={`h-20 w-full ${colorClass}`}
    >
      {containerWidth > 0 ? (
        <AreaChart
          width={containerWidth}
          height={80}
          data={chartData}
          margin={{ top: 8, right: 0, left: 0, bottom: 8 }}
        >
          <XAxis dataKey="index" hide tickLine={false} axisLine={false} />
          <YAxis
            hide
            tickLine={false}
            axisLine={false}
            domain={[0, yDomainMax]}
            allowDecimals
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeOpacity={0.8}
            fill="currentColor"
            fillOpacity={0.16}
            isAnimationActive={false}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      ) : null}
    </div>
  )
}

interface SpeedMetricsHoverContentProps {
  downloadHistory: number[]
  uploadHistory: number[]
  downloadSpeedText: string
  uploadSpeedText: string
  totalDownloaded: number
  totalUploaded: number
  freeSpaceOnDisk: number
}

const SpeedMetricsHoverContent = ({
  downloadHistory,
  uploadHistory,
  downloadSpeedText,
  uploadSpeedText,
  totalDownloaded,
  totalUploaded,
  freeSpaceOnDisk,
}: SpeedMetricsHoverContentProps) => {
  const { t } = useTranslation()
  const totalTransferred = totalDownloaded + totalUploaded

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
        {t('status.transfer_metrics')}
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between text-xs uppercase tracking-wide text-text-tertiary">
          <span>{t('status.download_speed')}</span>
          <span className="tabular-nums text-sm font-medium text-text-secondary">
            {downloadSpeedText}
          </span>
        </div>
        <SpeedSparkline
          data={downloadHistory}
          colorClass="text-blue"
          ariaLabel={t('status.download_speed')}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between text-xs uppercase tracking-wide text-text-tertiary">
          <span>{t('status.upload_speed')}</span>
          <span className="tabular-nums text-sm font-medium text-text-secondary">
            {uploadSpeedText}
          </span>
        </div>
        <SpeedSparkline
          data={uploadHistory}
          colorClass="text-green"
          ariaLabel={t('status.upload_speed')}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm tabular-nums">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-text-tertiary">
            {t('status.total_downloaded')}
          </span>
          <span className="font-medium text-text">
            {formatBytes(totalDownloaded)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-text-tertiary">
            {t('status.total_uploaded')}
          </span>
          <span className="font-medium text-text">
            {formatBytes(totalUploaded)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-text-tertiary">
            {t('status.disk_free')}
          </span>
          <span className="font-medium text-text">
            {formatBytes(freeSpaceOnDisk)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-text-tertiary">
            {t('status.total_transferred')}
          </span>
          <span className="font-medium text-text">
            {formatBytes(totalTransferred)}
          </span>
        </div>
      </div>
    </div>
  )
}

export const SpeedIndicators = ({
  variant = 'standard',
  showTotalData = false,
}: SpeedIndicatorsProps) => {
  const { t } = useTranslation()
  const { downloadSpeed, uploadSpeed } = useGlobalSpeeds()
  const { totalDownloaded, totalUploaded, freeSpaceOnDisk } =
    useGlobalTotalData()

  const handleHoverCardOpenChange = (open: boolean) => {
    if (!open) return
    // Ensure ResponsiveContainer measures non-zero width after content becomes visible
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
    })
  }

  const { download: downloadHistory, upload: uploadHistory } = useSpeedHistory(
    downloadSpeed,
    uploadSpeed,
  )

  const downloadSpeedInfo = formatSpeedWithStatus(downloadSpeed)
  const uploadSpeedInfo = formatSpeedWithStatus(uploadSpeed)

  const compactIndicator = (
    <div className="flex items-center gap-4 no-drag-region">
      <div className="flex items-center gap-2 text-xs">
        <i className="i-lucide-hard-drive text-sm text-blue/80" />
        <span className="text-text-tertiary text-xs">
          {t('status.disk_free')}
        </span>
        <span className="tabular-nums text-text-secondary text-right min-w-[70px]">
          {formatBytes(freeSpaceOnDisk)}
        </span>
      </div>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-2 text-xs">
        <i className="i-lucide-download text-sm text-blue/80" />
        <span className="tabular-nums text-text-secondary text-right min-w-[70px]">
          {downloadSpeedInfo.text}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <i className="i-lucide-upload text-sm text-green/80" />
        <span className="tabular-nums text-text-secondary text-right min-w-[70px]">
          {uploadSpeedInfo.text}
        </span>
      </div>
    </div>
  )

  const standardIndicator = (
    <div className="flex items-center gap-3 text-sm no-drag-region">
      <div className="flex items-center gap-1.5 shrink-0 tabular-nums whitespace-nowrap">
        <i className="i-lucide-hard-drive text-blue text-sm" />
        <span className="text-text">{formatBytes(freeSpaceOnDisk)}</span>
      </div>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-1.5 shrink-0 tabular-nums whitespace-nowrap">
        <i className="i-lucide-download-cloud text-blue text-sm" />
        <span className={downloadSpeedInfo.colorClass}>
          {downloadSpeedInfo.text}
        </span>
        {showTotalData && (
          <span className="text-text-tertiary">
            ({formatBytes(totalDownloaded)})
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0 tabular-nums whitespace-nowrap">
        <i className="i-lucide-upload-cloud text-green text-sm" />
        <span className={uploadSpeedInfo.colorClass}>
          {uploadSpeedInfo.text}
        </span>
        {showTotalData && (
          <span className="text-text-tertiary">
            ({formatBytes(totalUploaded)})
          </span>
        )}
      </div>
    </div>
  )

  const indicatorContent =
    variant === 'compact' ? compactIndicator : standardIndicator

  return (
    <HoverCard
      openDelay={120}
      closeDelay={120}
      onOpenChange={handleHoverCardOpenChange}
    >
      <HoverCardTrigger asChild>{indicatorContent}</HoverCardTrigger>
      <HoverCardContent align="end" sideOffset={12} className="space-y-4">
        <SpeedMetricsHoverContent
          downloadHistory={downloadHistory}
          uploadHistory={uploadHistory}
          downloadSpeedText={downloadSpeedInfo.text}
          uploadSpeedText={uploadSpeedInfo.text}
          totalDownloaded={totalDownloaded}
          totalUploaded={totalUploaded}
          freeSpaceOnDisk={freeSpaceOnDisk}
        />
        <HoverCardArrow />
      </HoverCardContent>
    </HoverCard>
  )
}
