/* eslint-disable ts/no-use-before-define */
import type { FC } from 'react'
import * as React from 'react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/shallow'

import {
  MENU_ITEM_SEPARATOR,
  MenuItemText,
  useShowContextMenu,
} from '~/atoms/context-menu'
import { Modal } from '~/components/ui/modal'
import { Prompt } from '~/components/ui/prompts'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip/Tooltip'
import { TorrentStateIcon } from '~/components/ui/torrent-state-icon'
import { getI18n } from '~/i18n'
import { getAiIntegrationEnabled } from '~/lib/ai-integration'
import { cn } from '~/lib/cn'
import {
  formatBytes,
  formatBytesSmart,
  formatSpeedWithStatus,
} from '~/lib/format'
import { CategorySelectPrompt } from '~/modules/dialogs/CategorySelectPrompt'
import { TagsSelectPrompt } from '~/modules/dialogs/TagsSelectPrompt'
import { ShareRatioLimitModal } from '~/modules/modals/ShareRatioLimitModal'
import { DeleteTorrentPrompt } from '~/modules/prompts/DeleteTorrentPrompt'
import {
  openTorrentContent,
  openTorrentSaveLocation,
  revealTorrentContent,
} from '~/modules/torrent/utils/path-actions'
import { torrentAiStore } from '~/modules/torrent-ai/store'
import type { TorrentInfo } from '~/types'

import { NameCell } from '../cells/NameCell'
// Move MemoCell component here from the main file
import { CELL_RENDERERS } from '../cells/StaticCellRenderers'
import { useTorrentSelection } from '../hooks/use-torrent-selection'
import type { TorrentTableVirtualizer } from '../hooks/use-torrent-table-virtualization'
import { TorrentActions, useTorrentDataStore } from '../stores'
import {
  useTorrentTableSelectors,
  useTorrentTableStore,
} from '../stores/torrent-table-store'
import type { TorrentTableConfig } from '../TorrentTableList'
import { getStatusConfig } from '../utils/status'

interface RowStickyStatus {
  isSticky: boolean
  remainingTime: number
}

const EMPTY_ROW_STICKY_STATUS: RowStickyStatus = {
  isSticky: false,
  remainingTime: 0,
}

const MemoCell: React.FC<{ columnId: string, rowIndex: number }> = React.memo(
  ({ columnId, rowIndex }) => {
    const Renderer = CELL_RENDERERS[columnId as keyof typeof CELL_RENDERERS] as
      | ((p: { rowIndex: number }) => React.ReactNode)
      | undefined

    if (!Renderer) {
      return null
    }
    return (
      <div className="relative">
        <Renderer rowIndex={rowIndex} />
      </div>
    )
  },
)

interface TableBodyProps extends TorrentTableConfig {
  rowVirtualizer: TorrentTableVirtualizer['rowVirtualizer']
  viewportHeight: number
  headerHeight: number
  isScrolling?: boolean
  logicalScrollMode?: boolean
}

export const TableBody: React.FC<TableBodyProps> = (props) => {
  const {
    getRowHeight,
    data,
    visibleColumnIds,
    gridTemplateColumns,
    columnOffsets,
    rowVirtualizer,
    viewportHeight,
    headerHeight,
    isScrolling = false,
    logicalScrollMode = false,
  } = props

  const { selectAndShowDetail } = useTorrentSelection()
  const activeTorrentHash = useTorrentTableStore(
    state => state.activeTorrentHash,
  )
  const { selectedTorrents, stickyFilterEntries } = useTorrentDataStore(
    useShallow(state => ({
      selectedTorrents: state.selectedTorrents,
      stickyFilterEntries: state.stickyFilterEntries,
    })),
  )
  const selectedTorrentSet = React.useMemo(
    () => new Set(selectedTorrents),
    [selectedTorrents],
  )
  const [stickySnapshotTime, setStickySnapshotTime] = React.useState(0)
  React.useEffect(() => {
    if (stickyFilterEntries.length > 0) {
      setStickySnapshotTime(Date.now())
    }
  }, [stickyFilterEntries])

  const stickyStatusByHash = React.useMemo(() => {
    if (!stickyFilterEntries.length) {
      return new Map<string, RowStickyStatus>()
    }

    const now = stickySnapshotTime || Number.POSITIVE_INFINITY
    const statusMap = new Map<string, RowStickyStatus>()
    for (const entry of stickyFilterEntries) {
      const remainingTime = Math.max(0, 60000 - (now - entry.operationTime))
      if (remainingTime > 0) {
        statusMap.set(entry.hash, {
          isSticky: true,
          remainingTime,
        })
      }
    }
    return statusMap
  }, [stickyFilterEntries, stickySnapshotTime])

  const rawScrollTop = Math.max(0, Number(rowVirtualizer.scrollOffset || 0))
  const viewportTop = !logicalScrollMode
    ? Math.max(0, rawScrollTop - headerHeight)
    : rawScrollTop
  const viewportBottom = viewportTop + viewportHeight

  const handleRowClick = React.useCallback(
    (rowIndex: number) => {
      const { sortedTorrents } = useTorrentDataStore.getState()
      const torrent = sortedTorrents[rowIndex]
      if (torrent) {
        selectAndShowDetail(torrent.hash)
      }
    },
    [selectAndShowDetail],
  )

  return (
    <div
      className="relative w-full"
      style={{
        contain: 'layout paint style',
        height: rowVirtualizer.getTotalSize(),
        transform: !logicalScrollMode
          ? undefined
          : 'translate3d(0, calc(var(--torrent-table-scroll-offset, 0px) * -1), 0)',
        pointerEvents: isScrolling ? 'none' : undefined,
        willChange: !logicalScrollMode ? undefined : 'transform',
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow, virtualSlotIndex) => {
        const rowIndex = virtualRow.index
        const rowHeight = getRowHeight(rowIndex)
        const rowTop = virtualRow.start
        const rowBottom = rowTop + rowHeight
        const isStrictInViewport
          = isScrolling || (rowBottom > viewportTop && rowTop < viewportBottom)
        const shouldRecycleRow = logicalScrollMode && isScrolling
        const rowKey = shouldRecycleRow
          ? `scroll-slot-${virtualSlotIndex}`
          : virtualRow.key
        const torrent = data[rowIndex]
        const checkboxSelected = torrent
          ? selectedTorrentSet.has(torrent.hash)
          : false
        const rowIsActive = torrent
          ? activeTorrentHash === torrent.hash || checkboxSelected
          : false
        const stickyStatus = torrent
          ? (stickyStatusByHash.get(torrent.hash) ?? EMPTY_ROW_STICKY_STATUS)
          : EMPTY_ROW_STICKY_STATUS

        return (
          <TorrentTableRow
            checkboxSelected={checkboxSelected}
            columnOffsets={columnOffsets}
            data-index={virtualRow.index}
            gridTemplateColumns={gridTemplateColumns}
            handleRowClick={handleRowClick}
            isInViewport={isStrictInViewport}
            isScrolling={isScrolling}
            key={rowKey}
            measureElement={
              !logicalScrollMode ? rowVirtualizer.measureElement : undefined
            }
            rowHeight={rowHeight}
            rowIndex={rowIndex}
            rowIsActive={rowIsActive}
            rowTop={rowTop}
            shouldRecycleRow={shouldRecycleRow}
            stickyStatus={stickyStatus}
            torrent={torrent}
            virtualRowIndex={virtualRow.index}
            visibleColumnIds={visibleColumnIds}
          />
        )
      })}
    </div>
  )
}

const TorrentTableRow = React.memo(
  ({
    checkboxSelected,
    columnOffsets,
    gridTemplateColumns,
    handleRowClick,
    isInViewport,
    isScrolling,
    measureElement,
    rowHeight,
    rowIndex,
    rowIsActive,
    rowTop,
    shouldRecycleRow,
    stickyStatus,
    torrent,
    virtualRowIndex,
    visibleColumnIds,
  }: {
    checkboxSelected: boolean
    columnOffsets: Record<string, number>
    gridTemplateColumns: string
    handleRowClick: (rowIndex: number) => void
    isInViewport: boolean
    isScrolling: boolean
    measureElement?: (node: Element | null) => void
    rowHeight: number
    rowIndex: number
    rowIsActive: boolean
    rowTop: number
    shouldRecycleRow: boolean
    stickyStatus: RowStickyStatus
    torrent: TorrentInfo | undefined
    virtualRowIndex: number
    visibleColumnIds: string[]
  }) => {
    const isOdd = virtualRowIndex % 2 === 0
    const RowWrapper = isScrolling ? PassiveCellWrapper : ActiveCellWrapper
    const passiveStateProps = isScrolling
      ? ({
          'data-selected': rowIsActive,
        } as const)
      : {}

    return (
      <RowWrapper
        {...passiveStateProps}
        rowIndex={rowIndex}
        data-index={virtualRowIndex}
        role="row"
        className={cn(
          'grid border-b group border-border hover:!bg-accent-10 top-0 left-0 min-w-full absolute data-[odd=true]:bg-background-secondary',
          isScrolling && rowIsActive && '!bg-accent/10',
          isScrolling
          && stickyStatus.isSticky
          && 'bg-orange/5 border-l-2 border-l-orange/50',
        )}
        data-odd={isOdd}
        style={{
          contain: 'layout paint style',
          gridTemplateColumns,
          transform: `translate3d(0, ${rowTop}px, 0)`,
          height: rowHeight,
        }}
        ref={measureElement}
        onClick={isScrolling ? undefined : () => handleRowClick(rowIndex)}
      >
        {visibleColumnIds.map((cid: string, columnIndex) => {
          const isSticky = cid === 'name' || cid === 'select'
          const left = isSticky ? (columnOffsets[cid] ?? 0) : undefined
          const cellKey = shouldRecycleRow ? cid : `${cid}-${rowIndex}`

          if (isScrolling) {
            return isSticky
              ? (
                  <div
                    key={cellKey}
                    className={cn(
                      'group-data-[odd=true]:bg-background-secondary bg-background group-hover:!bg-accent-10 group-data-[selected=true]:bg-transparent',
                      'before:content-[\'\'] before:absolute before:bottom-0 before:left-0 before:w-full before:h-px before:bg-border',
                    )}
                    style={{
                      gridColumn: columnIndex + 1,
                      position: 'sticky',
                      left,
                      zIndex: 4,
                    }}
                  >
                    <ScrollingCellPreview
                      checkboxSelected={checkboxSelected}
                      columnId={cid}
                      torrent={torrent}
                    />
                  </div>
                )
              : (
                  <div
                    key={cellKey}
                    className="relative min-w-0 overflow-hidden"
                    style={{
                      gridColumn: columnIndex + 1,
                    }}
                  >
                    <ScrollingCellPreview
                      checkboxSelected={checkboxSelected}
                      columnId={cid}
                      torrent={torrent}
                    />
                  </div>
                )
          }

          return isSticky
            ? (
                <div
                  key={cellKey}
                  className={cn(
                    'group-data-[odd=true]:bg-background-secondary bg-background group-hover:!bg-accent-10 group-data-[selected=true]:bg-transparent',
                    !isScrolling && 'backdrop-blur-xl',

                    'before:content-[\'\'] before:absolute before:bottom-0 before:left-0 before:w-full before:h-px before:bg-border',
                  )}
                  style={{
                    gridColumn: columnIndex + 1,
                    position: 'sticky',
                    left,
                    zIndex: 4,
                  }}
                >
                  {cid === 'name'
                    ? (
                        <NameCell rowIndex={rowIndex} isInViewport={isInViewport} />
                      )
                    : (
                        <MemoCell columnId={cid} rowIndex={rowIndex} />
                      )}
                </div>
              )
            : (
                <MemoCell key={cellKey} columnId={cid} rowIndex={rowIndex} />
              )
        })}
        {isScrolling && stickyStatus.isSticky && (
          <PassiveStickyIndicator remainingTime={stickyStatus.remainingTime} />
        )}
      </RowWrapper>
    )
  },
)

const PassiveStickyIndicator = React.memo(
  ({ remainingTime }: { remainingTime: number }) => (
    <div className="absolute z-10 top-1 left-1 flex items-center gap-1">
      <div className="size-2 rounded-full bg-orange animate-pulse" />
      <span className="text-xs text-orange font-medium opacity-75">
        {Math.ceil(remainingTime / 1000)}
        s
      </span>
    </div>
  ),
)

const ScrollingNamePreview = React.memo(
  ({ torrent }: { torrent: TorrentInfo | undefined }) => {
    if (!torrent?.name) {
      return (
        <div className="absolute inset-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="flex-shrink-0">
              <TorrentStateIcon
                state="unknown"
                className="text-lg text-text-tertiary"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-tertiary">
                Loading...
              </div>
            </div>
          </div>
        </div>
      )
    }

    const tagList = splitPreviewTags(torrent.tags)

    return (
      <div className="relative flex items-center gap-3 px-4 py-2">
        <div className="flex-shrink-0 pt-0.5">
          <TorrentStateIcon
            state={torrent.state}
            progress={torrent.progress}
            className="text-lg"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="text-sm font-medium text-text truncate">
            {torrent.name || 'Untitled'}
          </div>
          <div className="flex items-center gap-2 text-xs text-text-secondary min-w-0">
            <span className="truncate text-text-secondary">
              {torrent.category || 'Uncategorized'}
            </span>
            {tagList.length > 0 && (
              <div className="flex gap-1 overflow-hidden">
                {tagList.slice(0, 2).map(tag => (
                  <PreviewTag key={tag} tag={tag} />
                ))}
                {tagList.length > 2 && (
                  <PreviewTag
                    tag={`+${tagList.length - 2}`}
                    variant="tertiary"
                    title={tagList.slice(2).join(', ')}
                  />
                )}
              </div>
            )}
            <div className="ml-auto shrink-0 h-0 -translate-y-3 translate-x-2">
              <ScrollingAiMetadataPreview torrent={torrent} />
            </div>
          </div>
        </div>
      </div>
    )
  },
)

const formatPreviewConfidence = (value: number | null | undefined) => {
  if (value == null) {
    return ''
  }
  const percentage = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return `${percentage}%`
}

const NON_RETRYABLE_AI_PREVIEW_ERRORS = new Set([
  'ai.notSupported',
  'ai.openai.missingApiKey',
  'ai.openrouter.missingApiKey',
  'ai.providers.unavailable',
])

const ScrollingAiMetadataPreview = React.memo(
  ({ torrent }: { torrent: TorrentInfo }) => {
    const isElectron = typeof ELECTRON !== 'undefined' && ELECTRON
    if (!isElectron || !getAiIntegrationEnabled()) {
      return null
    }

    const entry = torrentAiStore.getState().entries[torrent.hash]
    if (!entry) {
      return null
    }

    if (entry.status === 'error') {
      if (entry.error && NON_RETRYABLE_AI_PREVIEW_ERRORS.has(entry.error)) {
        return null
      }
      return (
        <span
          className="inline-flex h-5 items-center gap-1 rounded-full border border-red/20 px-1.5 text-[10px] leading-none text-red/60"
          aria-label={getI18n().t('torrent.ai.status.error.default')}
        >
          <i
            className="i-mingcute-warning-line text-[12px]"
            aria-hidden="true"
          />
          <span>AI</span>
        </span>
      )
    }

    if (entry.status === 'loading') {
      return (
        <span className="inline-flex h-5 items-center gap-1 text-[10px] text-text-tertiary">
          <i
            className="i-mingcute-loading-3-line animate-spin text-[12px]"
            aria-hidden="true"
          />
          <span className="sr-only">
            {getI18n().t('torrent.ai.status.loading')}
          </span>
        </span>
      )
    }

    if (entry.status !== 'ready' || !entry.metadata) {
      return null
    }

    const mayBeTitle = entry.metadata.mayBeTitle?.trim()
    const confidenceLabel = formatPreviewConfidence(
      entry.metadata.confidence?.overall ?? null,
    )

    return (
      <span
        className="inline-flex h-5 items-center gap-1 rounded-full border border-border/50 bg-material-opaque px-1.5 text-[10px] leading-none text-text-tertiary hover:text-text"
        aria-label={getI18n().t('torrent.ai.actions.openDetails')}
      >
        {mayBeTitle
          ? (
              <i className="i-lucide-flame text-[12px]" aria-hidden="true" />
            )
          : (
              <i
                className="i-lucide-file-question-mark text-[12px]"
                aria-hidden="true"
              />
            )}
        {mayBeTitle
          ? (
              <span className="max-w-[200px] truncate">{mayBeTitle}</span>
            )
          : confidenceLabel
            ? (
                <span>{confidenceLabel}</span>
              )
            : null}
      </span>
    )
  },
)

const splitPreviewTags = (tags: string | undefined) => {
  return tags
    ? tags
        .split(',')
        .filter(Boolean)
        .map(tag => tag.trim())
    : []
}

const PreviewTag = React.memo(
  ({
    tag,
    title,
    variant = 'primary',
  }: {
    tag: string
    title?: string
    variant?: 'primary' | 'tertiary'
  }) => (
    <span
      className={cn(
        'px-2 py-1 rounded-md text-xs font-medium whitespace-pre min-w-0 truncate',
        variant === 'tertiary'
          ? 'bg-text-tertiary/20 text-text-tertiary cursor-default'
          : 'bg-accent/20 text-accent',
      )}
      title={title || tag}
    >
      {tag}
    </span>
  ),
)

const formatPreviewDateTime = (timestamp: number, simple?: boolean) => {
  if (!timestamp) {
    return '-'
  }
  const date = new Date(timestamp * 1000)

  return Intl.DateTimeFormat(getI18n().language, {
    timeStyle: simple ? 'short' : 'long',
    dateStyle: simple ? 'short' : 'long',
  }).format(date)
}

const formatPreviewRelativeDateTime = (
  timestamp: number | undefined,
  relativeMaxDays = 14,
) => {
  if (!timestamp || timestamp <= 0) {
    return '-'
  }

  const nowMs = Date.now()
  const ageSeconds = nowMs / 1000 - timestamp
  const relativeMaxSeconds = relativeMaxDays * 86400

  if (ageSeconds >= relativeMaxSeconds) {
    return formatPreviewDateTime(timestamp, true)
  }

  const absSeconds = Math.abs(Math.trunc((timestamp * 1000 - nowMs) / 1000))
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ] as const
  const [unit, unitSeconds]
    = units.find(([, seconds]) => absSeconds >= seconds) ?? units.at(-1)!
  const sign = timestamp * 1000 - nowMs < 0 ? -1 : 1
  const value = sign * Math.floor(absSeconds / unitSeconds)

  return new Intl.RelativeTimeFormat(getI18n().language || 'en', {
    style: 'short',
    numeric: 'auto',
  }).format(value, unit)
}

const formatPreviewDuration = (seconds: number | undefined) => {
  const value = typeof seconds === 'number' ? seconds : 0
  if (value <= 0) {
    return '-'
  }

  const days = Math.floor(value / 86400)
  const hours = Math.floor((value % 86400) / 3600)
  const minutes = Math.floor((value % 3600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

const ETA_INFINITY = 8640000

const formatPreviewEta = (torrent: TorrentInfo | undefined) => {
  if (!torrent) {
    return '-'
  }
  if (torrent.state === 'pausedUP' || torrent.state === 'stoppedUP') {
    return '-'
  }
  if (torrent.eta === ETA_INFINITY) {
    return <i className="i-lucide-infinity" />
  }
  if (torrent.eta < 0) {
    return getI18n().t('time.unknown')
  }
  if (torrent.eta === 0) {
    return getI18n().t('time.done')
  }

  const years = Math.floor(torrent.eta / 31536000)
  const months = Math.floor((torrent.eta % 31536000) / 2592000)
  const days = Math.floor(torrent.eta / 86400)
  const hours = Math.floor((torrent.eta % 86400) / 3600)
  const minutes = Math.floor((torrent.eta % 3600) / 60)

  const t = getI18n().t
  const y = t('time.units.y')
  const mo = t('time.units.mo')
  const d = t('time.units.d')
  const h = t('time.units.h')
  const m = t('time.units.m')

  if (years > 0) {
    return `${years}${y} ${months}${mo}`
  }
  if (months > 0) {
    return `${months}${mo} ${days}${d}`
  }
  if (days > 0) {
    return `${days}${d} ${hours}${h}`
  }
  if (hours > 0) {
    return `${hours}${h} ${minutes}${m}`
  }
  return `${minutes}${m}`
}

const formatPreviewRatio = (ratio: number) => {
  if (ratio < 0) {
    return '∞'
  }
  return ratio.toFixed(2)
}

const getPreviewPriorityText = (priority: number) => {
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

const getPreviewTrackerDomain = (url: string) => {
  if (!url) {
    return '-'
  }
  try {
    const domain = new URL(url).hostname
    return domain.replace(/^www\./, '')
  }
  catch {
    return url.length > 20 ? `${url.slice(0, 17)}...` : url
  }
}

const getPreviewShortPath = (path: string) => {
  if (!path) {
    return '-'
  }
  const parts = path.split(/[/\\]/)
  if (parts.length <= 2) {
    return path
  }
  return `.../${parts.slice(-2).join('/')}`
}

const getPreviewText = (columnId: string, torrent: TorrentInfo | undefined) => {
  if (!torrent) {
    return '-'
  }

  switch (columnId) {
    case 'size':
      return formatBytesSmart(torrent.size)
    case 'dlspeed':
      return formatSpeedWithStatus(torrent.dlspeed).text
    case 'upspeed':
      return formatSpeedWithStatus(torrent.upspeed).text
    case 'ratio':
      return formatPreviewRatio(torrent.ratio)
    case 'state':
      return getI18n().t(getStatusConfig(torrent.state).label)
    case 'priority':
      return getPreviewPriorityText(torrent.priority)
    case 'tracker':
      return getPreviewTrackerDomain(torrent.tracker)
    case 'category':
      return torrent.category || '-'
    case 'tags':
      return splitPreviewTags(torrent.tags).slice(0, 2).join(', ') || '-'
    case 'added_on':
      return formatPreviewRelativeDateTime(torrent.added_on)
    case 'completion_on':
      return formatPreviewRelativeDateTime(torrent.completion_on)
    case 'last_activity':
      return formatPreviewRelativeDateTime(torrent.last_activity)
    case 'save_path':
      return getPreviewShortPath(torrent.save_path)
    case 'downloaded':
      return formatBytes(torrent.downloaded)
    case 'uploaded':
      return formatBytes(torrent.uploaded)
    case 'num_seeds':
      return torrent.num_seeds.toString()
    case 'num_leechs':
      return torrent.num_leechs.toString()
    case 'amount_left':
      return torrent.amount_left > 0 ? formatBytes(torrent.amount_left) : '-'
    case 'time_active':
      return formatPreviewDuration(torrent.time_active)
    case 'seeding_time':
      return formatPreviewDuration(torrent.seeding_time)
    default:
      return '-'
  }
}

const ScrollingCellPreview = React.memo(
  ({
    checkboxSelected,
    columnId,
    torrent,
  }: {
    checkboxSelected: boolean
    columnId: string
    torrent: TorrentInfo | undefined
  }) => {
    if (columnId === 'name') {
      return <ScrollingNamePreview torrent={torrent} />
    }

    if (columnId === 'select') {
      return (
        <div className="flex items-center absolute inset-x-0 top-4 justify-center">
          <span
            className="peer flex items-center justify-center shrink-0 rounded-sm bg-gray9/10 transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent data-[state=checked]:text-white size-5 border border-border"
            data-state={checkboxSelected ? 'checked' : 'unchecked'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="3.5"
              stroke="currentColor"
              className={cn(
                'size-3.5',
                checkboxSelected ? 'opacity-100' : 'opacity-0',
              )}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </span>
        </div>
      )
    }

    if (columnId === 'progress') {
      const progress = Math.max(0, Math.min(1, torrent?.progress ?? 0))
      const percentage = Number.parseFloat((progress * 100).toFixed(2))
      return (
        <div className="px-2 absolute inset-0 flex top-4">
          <div className="relative w-full h-4 bg-gray9/20 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent to-accent/80 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${percentage}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium text-text-secondary">
                {percentage}
                %
              </span>
            </div>
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                clipPath: `inset(0 ${100 - percentage}% 0 0)`,
                transition: 'clip-path 300ms ease-out',
              }}
            >
              <span className="text-xs font-medium text-white">
                {percentage}
                %
              </span>
            </div>
          </div>
        </div>
      )
    }

    if (columnId === 'state') {
      const stateConfig = torrent
        ? getStatusConfig(torrent.state)
        : getStatusConfig('unknown')
      return (
        <div className="flex items-center px-2 absolute inset-x-2 top-3 justify-center">
          <span
            className={cn(
              'inline-flex whitespace-pre truncate items-center px-2 py-1 rounded-full text-xs font-medium border',
              stateConfig.className,
            )}
          >
            {getPreviewText(columnId, torrent)}
          </span>
        </div>
      )
    }

    if (columnId === 'size') {
      return (
        <div className="flex items-center justify-end px-2 absolute inset-x-0 top-4">
          <span className="text-sm tabular-nums text-text">
            {getPreviewText(columnId, torrent)}
          </span>
        </div>
      )
    }

    if (columnId === 'dlspeed' || columnId === 'upspeed') {
      const speed = columnId === 'dlspeed' ? torrent?.dlspeed : torrent?.upspeed
      const { text, colorClass } = formatSpeedWithStatus(speed || 0)
      return (
        <div className="flex items-center justify-end absolute inset-x-2 top-4">
          <span className={cn('text-sm tabular-nums', colorClass)}>{text}</span>
        </div>
      )
    }

    if (columnId === 'eta') {
      return (
        <div className="flex items-center justify-center px-2 absolute inset-x-2 top-4">
          <span className="text-sm tabular-nums text-text">
            {formatPreviewEta(torrent)}
          </span>
        </div>
      )
    }

    if (columnId === 'ratio') {
      return (
        <div className="flex items-center justify-end px-2 absolute inset-x-4 top-4">
          <span className="text-sm tabular-nums text-text">
            {getPreviewText(columnId, torrent)}
          </span>
        </div>
      )
    }

    if (columnId === 'category') {
      return (
        <div className="flex items-center px-2 py-2 text-sm text-text">
          {torrent?.category
            ? (
                <PreviewTag tag={torrent.category} />
              )
            : (
                <span className="text-text-tertiary">-</span>
              )}
        </div>
      )
    }

    if (columnId === 'tags') {
      const tagList = splitPreviewTags(torrent?.tags)
      return (
        <div className="flex items-center text-sm px-2 py-3">
          {tagList.length > 0
            ? (
                <div className="flex flex-wrap gap-1 max-w-full">
                  {tagList.map(tag => (
                    <PreviewTag key={tag} tag={tag} />
                  ))}
                </div>
              )
            : (
                <div className="text-text-tertiary text-xs">No tags</div>
              )}
        </div>
      )
    }

    if (columnId === 'tracker') {
      return (
        <div className="flex items-center px-2 py-4 text-sm text-text truncate">
          <span title={torrent?.tracker || ''}>
            {getPreviewText(columnId, torrent)}
          </span>
        </div>
      )
    }

    if (columnId === 'save_path') {
      return (
        <div className="flex items-center px-2 py-4 text-sm text-text">
          <span title={torrent?.save_path || ''} className="truncate">
            {getPreviewText(columnId, torrent)}
          </span>
        </div>
      )
    }

    if (columnId === 'priority') {
      return (
        <div className="flex items-center justify-center px-2 py-2 text-sm text-text">
          {getPreviewText(columnId, torrent)}
        </div>
      )
    }

    if (columnId === 'num_seeds') {
      return (
        <div className="flex items-center justify-center px-2 py-4 text-sm text-text tabular-nums">
          <span>
            {torrent?.num_seeds || 0}
            {torrent?.num_complete !== undefined
              && torrent.num_complete !== torrent.num_seeds && (
              <span className="text-text-secondary">
                {' '}
                (
                {torrent.num_complete}
                )
              </span>
            )}
          </span>
        </div>
      )
    }

    if (columnId === 'num_leechs') {
      return (
        <div className="flex items-center justify-center px-2 py-2 text-sm text-text tabular-nums">
          <span>
            {torrent?.num_leechs || 0}
            {torrent?.num_incomplete !== undefined
              && torrent.num_incomplete !== torrent.num_leechs && (
              <span className="text-text-secondary">
                {' '}
                (
                {torrent.num_incomplete}
                )
              </span>
            )}
          </span>
        </div>
      )
    }

    if (
      columnId === 'added_on'
      || columnId === 'completion_on'
      || columnId === 'last_activity'
    ) {
      return (
        <div className="flex items-center justify-end px-2 top-4 absolute inset-x-0 text-sm text-text">
          <span className="tabular-nums">
            {getPreviewText(columnId, torrent)}
          </span>
        </div>
      )
    }

    if (
      columnId === 'downloaded'
      || columnId === 'uploaded'
      || columnId === 'time_active'
      || columnId === 'seeding_time'
    ) {
      return (
        <div className="flex items-center justify-end px-2 py-4 text-sm text-text tabular-nums">
          {getPreviewText(columnId, torrent)}
        </div>
      )
    }

    if (columnId === 'amount_left') {
      return (
        <div className="flex items-center justify-end px-2 py-2 text-sm text-text tabular-nums">
          {getPreviewText(columnId, torrent)}
        </div>
      )
    }

    return (
      <div className="flex h-full min-w-0 items-center px-2 py-2 text-sm text-text">
        <span className="truncate">{getPreviewText(columnId, torrent)}</span>
      </div>
    )
  },
)

const PassiveCellWrapper: FC<
  React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  > & { children: React.ReactNode, rowIndex: number }
> = ({ children, rowIndex: _rowIndex, ...rest }) => {
  return <div {...rest}>{children}</div>
}

const ActiveCellWrapper: FC<
  React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  > & { children: React.ReactNode, rowIndex: number }
> = ({ children, rowIndex, className, ...rest }) => {
  const isSelected = useTorrentTableSelectors.useRowActiveByIndex(rowIndex)
  const showContextMenu = useShowContextMenu()

  // Check if this torrent is in sticky filter state
  const stickyStatus = useTorrentDataStore(
    useShallow((state) => {
      const torrent = state.sortedTorrents[rowIndex]
      if (!torrent) {
        return { isSticky: false, remainingTime: 0 }
      }

      const now = Date.now()
      const stickyEntry = state.stickyFilterEntries.find(
        entry => entry.hash === torrent.hash,
      )

      if (!stickyEntry) {
        return { isSticky: false, remainingTime: 0 }
      }

      const elapsed = now - stickyEntry.operationTime
      const remainingTime = Math.max(0, 60000 - elapsed) // 1 minute

      return {
        isSticky: remainingTime > 0,
        remainingTime,
      }
    }),
  )

  const handleContextMenu = React.useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      const { sortedTorrents, selectedTorrents }
        = useTorrentDataStore.getState()
      const currentTorrent = sortedTorrents[rowIndex]
      const torrents = [...new Set([currentTorrent.hash, ...selectedTorrents])]

      const { t } = getI18n()
      if (!currentTorrent) {
        return
      }

      const items = [
        ...(ELECTRON
          ? ([
              new MenuItemText({
                label: t('contextMenu.openContent'),
                icon: <i className="i-lucide-external-link" />,
                click: () => {
                  void openTorrentContent(currentTorrent)
                },
              }),
              new MenuItemText({
                label: t('contextMenu.revealContent'),
                icon: <i className="i-lucide-eye" />,
                click: () => {
                  void revealTorrentContent(currentTorrent)
                },
              }),
              new MenuItemText({
                label: t('contextMenu.openSaveLocation'),
                icon: <i className="i-lucide-folder-open" />,
                click: () => {
                  void openTorrentSaveLocation(currentTorrent)
                },
              }),
              MENU_ITEM_SEPARATOR,
            ] as const)
          : []),
        new MenuItemText({
          label: t('contextMenu.resume'),
          icon: <i className="i-lucide-play" />,
          click: () => TorrentActions.shared.resumeTorrents(torrents),
        }),
        new MenuItemText({
          label: t('contextMenu.forceResume'),
          icon: <i className="i-lucide-fast-forward" />,
          click: () => TorrentActions.shared.forceResumeTorrents(torrents),
        }),
        new MenuItemText({
          label: t('contextMenu.pause'),
          icon: <i className="i-lucide-pause" />,
          click: () => TorrentActions.shared.pauseTorrents(torrents),
        }),
        MENU_ITEM_SEPARATOR,
        new MenuItemText({
          label: t('contextMenu.delete'),
          icon: <i className="i-lucide-trash-2" />,
          click: () =>
            DeleteTorrentPrompt.show({
              torrentName:
                torrents.length > 1
                  ? t('torrent.multipleSelection')
                  : currentTorrent.name,
              onConfirm: deleteFiles =>
                TorrentActions.shared.deleteTorrents(torrents, deleteFiles),
            }),
        }),
        MENU_ITEM_SEPARATOR,
        new MenuItemText({
          label: t('contextMenu.changeSaveLocation'),
          icon: <i className="i-lucide-folder-open" />,
          click: async () => {
            const defaultValue = currentTorrent.save_path || ''
            const newLocation = await Prompt.input({
              title: t('prompts.changeSaveLocation.title'),
              description: t('prompts.changeSaveLocation.description'),
              defaultValue,
              placeholder: t('prompts.changeSaveLocation.placeholder'),
            })
            if (newLocation) {
              TorrentActions.shared.setTorrentLocation(torrents, newLocation)
            }
          },
        }),
        new MenuItemText({
          label: t('contextMenu.rename'),
          icon: <i className="i-lucide-edit-3" />,
          click: async () => {
            const newName = await Prompt.input({
              title: t('prompts.renameTorrent.title'),
              description: t('prompts.renameTorrent.description'),
              defaultValue: currentTorrent.name || '',
              placeholder: t('prompts.renameTorrent.placeholder'),
            })
            if (newName && newName !== currentTorrent.name) {
              TorrentActions.shared.renameTorrent(currentTorrent.hash, newName)
            }
          },
        }),
        new MenuItemText({
          label: t('contextMenu.renameFile'),
          icon: <i className="i-lucide-file-text" />,
          click: () => {
            Prompt.prompt({
              title: t('prompts.renameFile.title'),
              description: t('prompts.renameFile.description'),
              content: t('prompts.renameFile.content'),
              onConfirmText: t('prompts.renameFile.confirmText'),
            })
          },
        }),
        MENU_ITEM_SEPARATOR,
        new MenuItemText({
          label: t('contextMenu.sequentialDownload'),
          icon: <i className="i-lucide-list-ordered" />,
          checked: currentTorrent.seq_dl,
          click: () => TorrentActions.shared.toggleSequentialDownload(torrents),
        }),
        new MenuItemText({
          label: t('contextMenu.firstLastPiecePriority'),
          icon: <i className="i-lucide-arrow-up-down" />,
          checked: currentTorrent.f_l_piece_prio,
          click: () =>
            TorrentActions.shared.toggleFirstLastPiecePriority(torrents),
        }),
        MENU_ITEM_SEPARATOR,
        new MenuItemText({
          label: t('contextMenu.category'),
          icon: <i className="i-lucide-folder" />,
          click: () => {
            CategorySelectPrompt.show({
              currentCategory:
                torrents.length > 1
                  ? t('torrent.multipleCategories')
                  : currentTorrent.category || '',
              onConfirm: async (category: string) => {
                await TorrentActions.shared.setTorrentCategory(
                  torrents,
                  category || undefined,
                )
                toast.success(getI18n().t('messages.categoryUpdated'))
              },
            })
          },
        }),
        new MenuItemText({
          label: t('contextMenu.tags'),
          icon: <i className="i-lucide-tag" />,
          click: () => {
            const currentTags = Array.isArray(currentTorrent.tags)
              ? currentTorrent.tags
              : (currentTorrent.tags || '').split(', ').filter(Boolean)

            TagsSelectPrompt.show({
              currentTags,
              onConfirm: (tags: string[]) => {
                const tagsToAdd = tags.filter(
                  tag => !currentTags.includes(tag),
                )
                const tagsToRemove = currentTags.filter(
                  tag => !tags.includes(tag),
                )

                // Remove tags first, then add new ones
                if (tagsToRemove.length > 0) {
                  TorrentActions.shared.removeTorrentTags(
                    torrents,
                    tagsToRemove,
                  )
                }
                if (tagsToAdd.length > 0) {
                  TorrentActions.shared.addTorrentTags(torrents, tagsToAdd)
                }
              },
            })
          },
        }),
        new MenuItemText({
          label: t('contextMenu.automaticTorrentManagement'),
          icon: <i className="i-lucide-settings" />,
          checked: currentTorrent.auto_tmm,
          click: () => {
            Prompt.prompt({
              title: t('prompts.automaticTorrentManagement.title'),
              description: t('prompts.automaticTorrentManagement.description'),
              content: t('prompts.automaticTorrentManagement.content'),
              onConfirmText: t('prompts.automaticTorrentManagement.enableText'),
              onCancelText: t('prompts.automaticTorrentManagement.disableText'),
              onConfirm: () =>
                TorrentActions.shared.setAutoManagement(torrents, true),
              onCancel: () =>
                TorrentActions.shared.setAutoManagement(torrents, false),
            })
          },
        }),
        MENU_ITEM_SEPARATOR,
        new MenuItemText({
          label: t('contextMenu.limitDownloadSpeed'),
          icon: <i className="i-lucide-cloud-download" />,
          click: async () => {
            const limit = await Prompt.input({
              title: t('prompts.setDownloadSpeedLimit.title'),
              description: t('prompts.setDownloadSpeedLimit.description'),
              defaultValue: currentTorrent.dl_limit?.toString() || '-1',
              placeholder: t('prompts.setDownloadSpeedLimit.placeholder'),
            })
            if (limit !== null) {
              const limitValue = Number.parseInt(limit, 10)
              if (!Number.isNaN(limitValue)) {
                TorrentActions.shared.setTorrentDownloadLimit(
                  torrents,
                  limitValue,
                )
              }
            }
          },
        }),
        new MenuItemText({
          label: t('contextMenu.limitUploadSpeed'),
          icon: <i className="i-lucide-upload-cloud" />,
          click: async () => {
            const limit = await Prompt.input({
              title: t('prompts.setUploadSpeedLimit.title'),
              description: t('prompts.setUploadSpeedLimit.description'),
              defaultValue: currentTorrent.up_limit?.toString() || '-1',
              placeholder: t('prompts.setUploadSpeedLimit.placeholder'),
            })
            if (limit !== null) {
              const limitValue = Number.parseInt(limit, 10)
              if (!Number.isNaN(limitValue)) {
                TorrentActions.shared.setTorrentUploadLimit(
                  torrents,
                  limitValue,
                )
              }
            }
          },
        }),
        new MenuItemText({
          label: t('contextMenu.limitShareRatio'),
          icon: <i className="i-lucide-percent" />,
          click: () => {
            Modal.present(ShareRatioLimitModal, {
              currentRatio: currentTorrent.ratio_limit,
              currentSeedingTime: currentTorrent.seeding_time_limit,
              currentInactiveSeedingTime: -1, // Not available in TorrentInfo type
              onConfirm: (settings) => {
                TorrentActions.shared.setShareLimits(
                  torrents,
                  settings.ratioLimit,
                  settings.seedingTimeLimit,
                  settings.inactiveSeedingTimeLimit,
                )
              },
            })
          },
        }),
        new MenuItemText({
          label: t('contextMenu.superSeedingMode'),
          icon: <i className="i-lucide-zap" />,
          checked: currentTorrent.super_seeding,
          click: () => {
            Prompt.prompt({
              title: t('prompts.superSeedingMode.title'),
              description: t('prompts.superSeedingMode.description'),
              content: t('prompts.superSeedingMode.content'),
              onConfirmText: t('prompts.superSeedingMode.enableText'),
              onCancelText: t('prompts.superSeedingMode.disableText'),
              onConfirm: () =>
                TorrentActions.shared.setSuperSeeding(torrents, true),
              onCancel: () =>
                TorrentActions.shared.setSuperSeeding(torrents, false),
            })
          },
        }),
        MENU_ITEM_SEPARATOR,
        new MenuItemText({
          label: t('contextMenu.forceRecheck'),
          icon: <i className="i-lucide-refresh-cw" />,
          click: () => TorrentActions.shared.recheckTorrents(torrents),
        }),
        new MenuItemText({
          label: t('contextMenu.forceReannounce'),
          icon: <i className="i-lucide-megaphone" />,
          click: () => TorrentActions.shared.reannounceTorrents(torrents),
        }),
        MENU_ITEM_SEPARATOR,
        new MenuItemText({
          label: t('contextMenu.copy'),
          icon: <i className="i-lucide-copy" />,
          submenu: [
            new MenuItemText({
              label: t('contextMenu.copyMagnetLink'),
              icon: <i className="i-lucide-magnet" />,
              click: () => {
                TorrentActions.shared.copyMagnetLink(currentTorrent.hash)
                toast.success(getI18n().t('messages.magnetCopied'))
              },
            }),
            new MenuItemText({
              label: t('contextMenu.copyName'),
              icon: <i className="i-lucide-type" />,
              click: () => {
                navigator.clipboard?.writeText(currentTorrent.name || '')
                toast.success(getI18n().t('messages.nameCopied'))
              },
            }),
          ],
        }),
      ]

      await showContextMenu(items, e)
    },
    [rowIndex, showContextMenu],
  )
  return (
    <div
      onContextMenu={handleContextMenu}
      data-selected={isSelected}
      className={cn(
        'relative group/actice-cell',
        isSelected && '!bg-accent/10',
        stickyStatus.isSticky && 'bg-orange/5 border-l-2 border-l-orange/50',
        className,
      )}
      {...rest}
    >
      {children}
      {/* Sticky indicator */}
      {stickyStatus.isSticky && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute z-10 top-1 left-1 flex items-center gap-1 cursor-help">
              <div className="size-2 rounded-full bg-orange animate-pulse" />
              <span className="text-xs text-orange font-medium opacity-75">
                {Math.ceil(stickyStatus.remainingTime / 1000)}
                s
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">
            <div className="max-w-xs">
              {getI18n().t('torrent.stickyFilter.tooltip', {
                seconds: Math.ceil(stickyStatus.remainingTime / 1000),
              })}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
