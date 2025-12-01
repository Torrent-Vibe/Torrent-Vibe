import { useAtomValue, useSetAtom } from 'jotai'
import type { PanInfo } from 'motion/react'
import { m } from 'motion/react'
import { useCallback, useDeferredValue, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/shallow'

import { cn } from '~/lib/cn'
import { Spring } from '~/lib/spring'
import { Tag } from '~/modules/torrent/components/Tag'
import { useTorrentDataStore } from '~/modules/torrent/stores'
import {
  selectTorrentName,
  selectTorrentProgress,
  selectTorrentSelectionData,
  selectTorrentStatus,
} from '~/modules/torrent/stores/torrent-selectors'
import { getStatusConfig } from '~/modules/torrent/utils/status'

import {
  isCardExpandedAtom,
  multiSelectModeAtom,
  toggleCardExpansionAtom,
} from '../atoms/mobile-layout'
import { useMobileFieldConfig } from '../hooks/use-mobile-field-config'
import type { MobileCellField, TorrentData } from '../types'
import { useMobileDetailBottomSheet } from './MobileDetailBottomSheet'

interface MobileTorrentCardConfigurableProps {
  rowIndex: number
  className?: string

  onTap?: (torrentHash: string) => void
  onSwipeLeft?: (torrentHash: string) => void
  onSwipeRight?: (torrentHash: string) => void
}

export const MobileTorrentCardConfigurable = ({
  rowIndex,
  className,
  onTap,
  onSwipeLeft,
  onSwipeRight,
}: MobileTorrentCardConfigurableProps) => {
  const { t } = useTranslation()
  const deferredRowIndex = useDeferredValue(rowIndex)
  const { visibleFields, config } = useMobileFieldConfig()
  const { openDetailSheet } = useMobileDetailBottomSheet()

  // Get basic data needed for all cards
  const nameData = useTorrentDataStore(
    useShallow(
      useCallback(
        (state) => selectTorrentName(state, deferredRowIndex),
        [deferredRowIndex],
      ),
    ),
  )

  const progressData = useTorrentDataStore(
    useShallow(
      useCallback(
        (state) => selectTorrentProgress(state, deferredRowIndex),
        [deferredRowIndex],
      ),
    ),
  )

  const statusData = useTorrentDataStore(
    useShallow(
      useCallback(
        (state) => selectTorrentStatus(state, deferredRowIndex),
        [deferredRowIndex],
      ),
    ),
  )

  const selectionData = useTorrentDataStore(
    useShallow(
      useCallback(
        (state) => selectTorrentSelectionData(state, deferredRowIndex),
        [deferredRowIndex],
      ),
    ),
  )

  // Atoms
  const multiSelectMode = useAtomValue(multiSelectModeAtom)
  const isExpanded = useAtomValue(isCardExpandedAtom)
  const toggleExpansion = useSetAtom(toggleCardExpansionAtom)

  // Build torrent data object for field rendering
  const torrentData: TorrentData = useMemo(() => {
    // Get the raw torrent from store for additional data
    const rawTorrent = useTorrentDataStore.getState().torrents[deferredRowIndex]

    return {
      hash: selectionData.hash,
      name: nameData.name,
      size: progressData?.size || 0,
      completed: progressData?.completed || 0,
      progress: progressData?.progress || 0,
      state: statusData?.state || '',
      category: nameData.category || '',
      tags: nameData.tags || '',
      dlspeed: rawTorrent?.dlspeed || 0,
      upspeed: rawTorrent?.upspeed || 0,
      eta: rawTorrent?.eta || 0,
      ratio: rawTorrent?.ratio || 0,
      priority: rawTorrent?.priority || 0,
      addedOn: rawTorrent?.added_on || 0,
      completedOn: rawTorrent?.completion_on || 0,
      seeds: rawTorrent?.num_seeds || 0,
      peers: rawTorrent?.num_leechs || 0,
      uploaded: rawTorrent?.uploaded || 0,
      timeActive: rawTorrent?.time_active || 0,
      tracker: rawTorrent?.tracker || '',
      savePath: rawTorrent?.save_path || '',
    }
  }, [nameData, progressData, statusData, selectionData, deferredRowIndex])

  // Group fields by position
  const fieldGroups = useMemo(() => {
    const groups = {
      primary: visibleFields.filter((f) => f.primary),
      secondary: visibleFields.filter((f) => f.secondary),
      trailing: visibleFields.filter((f) => f.trailing),
    }

    return groups
  }, [visibleFields])

  // Status configuration
  const { label: statusLabelKey, className: statusClassName } = useMemo(
    () => getStatusConfig(statusData?.state || ''),
    [statusData?.state],
  )
  const statusLabel = t(statusLabelKey)

  // Progress calculation
  const percentage = useMemo(
    () => Number.parseFloat(((progressData?.progress || 0) * 100).toFixed(2)),
    [progressData?.progress],
  )

  // Icon based on state
  const torrentIcon = useMemo(() => {
    const progress = progressData?.progress || 0
    const state = progressData?.state || ''

    if (progress === 1) return 'i-mingcute-check-circle-fill text-green'
    if (state === 'downloading') return 'i-mingcute-download-2-line text-blue'
    if (state === 'uploading') return 'i-mingcute-upload-2-line text-green'
    if (state === 'error') return 'i-mingcute-close-circle-fill text-red'
    return 'i-mingcute-file-line text-placeholder-text'
  }, [progressData?.progress, progressData?.state])

  // Gesture handlers
  const handleTap = useCallback(() => {
    if (multiSelectMode) {
      return
    }

    if (onTap) {
      onTap(selectionData.hash)
    } else {
      openDetailSheet(selectionData.hash)
    }
  }, [multiSelectMode, onTap, selectionData.hash, openDetailSheet])

  const handlePan = useCallback(
    (_event: Event, info: PanInfo) => {
      const { offset } = info
      const threshold = 100 // px

      if (Math.abs(offset.x) > threshold) {
        if (offset.x > 0 && onSwipeRight) {
          onSwipeRight(selectionData.hash)
        } else if (offset.x < 0 && onSwipeLeft) {
          onSwipeLeft(selectionData.hash)
        }
      }
    },
    [onSwipeLeft, onSwipeRight, selectionData.hash],
  )

  const handleToggleExpansion = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      toggleExpansion(selectionData.hash)
    },
    [toggleExpansion, selectionData.hash],
  )

  // Field rendering helper
  const renderField = useCallback(
    (field: MobileCellField) => {
      const value =
        field.key === 'custom'
          ? torrentData
          : torrentData[field.key as keyof TorrentData]

      const displayValue = field.formatter
        ? field.formatter(value, torrentData)
        : value?.toString() || ''

      if (!displayValue || displayValue === '0' || displayValue === 'Unknown') {
        return null
      }

      return (
        <div key={field.id} className="flex items-center gap-1">
          {field.icon && <i className={cn('text-xs', field.icon)} />}
          <span>{displayValue}</span>
        </div>
      )
    },
    [torrentData],
  )

  // Don't render if no data
  if (!nameData.name) {
    return (
      <div className="bg-background mx-4 mb-0 min-h-[64px] flex items-center px-4 py-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-5 h-5 bg-fill-secondary rounded-full animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-fill-secondary rounded animate-pulse w-3/4" />
            <div className="h-3 bg-fill-secondary rounded animate-pulse w-1/2" />
          </div>
        </div>
        <div className="h-px bg-border mx-4" />
      </div>
    )
  }

  const hasExpandableContent = fieldGroups.trailing.length > 2 || nameData.tags

  return (
    <m.div
      className={cn(
        'relative bg-background border-0 mx-4 mb-0 overflow-hidden',
        'active:bg-material-medium transition-colors',
        selectionData.isSelected && 'bg-accent/10 border-l-4 border-l-accent',
        multiSelectMode && 'cursor-pointer',
        className,
      )}
      layout="position"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={Spring.presets.smooth}
      onTap={handleTap}
      onPan={handlePan}
      whileTap={{ scale: 0.98 }}
    >
      {/* iOS-style cell content */}
      <div className="flex min-w-0 flex-col px-3 sm:px-4 py-3 min-h-[64px] relative">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Leading icon or selection indicator */}
          <div className="flex-shrink-0">
            {multiSelectMode ? (
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                  selectionData.isSelected
                    ? 'bg-accent border-accent'
                    : 'border-border bg-background',
                )}
              >
                {selectionData.isSelected && (
                  <i className="i-mingcute-check-line text-white text-xs" />
                )}
              </div>
            ) : (
              <i className={cn('text-lg', torrentIcon)} />
            )}
          </div>

          {/* Main content area */}
          <div className="flex-1 min-w-0">
            {/* Primary field (title) */}
            {fieldGroups.primary.map((field) => (
              <div
                key={field.id}
                className="text-base font-normal text-text leading-tight mb-1 min-w-0"
              >
                <div className="truncate pr-2">
                  {field.id === 'name'
                    ? nameData.name
                    : renderField(field)?.props?.children}
                </div>
              </div>
            ))}

            {/* Secondary fields (subtitle) - adaptive display */}
            {fieldGroups.secondary.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-placeholder-text flex-wrap">
                {fieldGroups.secondary.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-1.5 min-w-0"
                  >
                    {index > 0 && (
                      <span className="text-placeholder-text text-xs">•</span>
                    )}
                    {field.id === 'status' ? (
                      <span
                        className={cn(
                          'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0',
                          statusClassName,
                        )}
                      >
                        {statusLabel}
                      </span>
                    ) : (
                      <span className="text-xs truncate max-w-[80px] sm:max-w-[120px] inline-flex items-center gap-1">
                        {renderField(field)?.props?.children}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trailing accessory */}
          <div className="flex-shrink-0 flex items-center gap-1.5">
            {/* Trailing fields - adaptive sizing */}
            <div className="flex flex-col items-end gap-1 text-xs text-text-secondary min-w-0">
              {fieldGroups.trailing.slice(0, 2).map((field) => (
                <span
                  key={field.id}
                  className="font-mono tabular-nums inline-flex items-center gap-1 truncate max-w-[60px] sm:max-w-[80px] md:max-w-[100px]"
                >
                  {renderField(field)?.props?.children}
                </span>
              ))}
            </div>

            {/* Expand/collapse button - only show if there's more content */}
            {hasExpandableContent && (
              <button
                type="button"
                onClick={handleToggleExpansion}
                className={cn(
                  'p-1 -m-1 text-placeholder-text hover:text-text transition-colors flex-shrink-0',
                )}
                aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
              >
                <i
                  className={cn(
                    'text-sm transition-transform duration-200',
                    isExpanded ? 'i-mingcute-up-line' : 'i-mingcute-down-line',
                  )}
                />
              </button>
            )}
          </div>
        </div>
        {config.showProgress && (
          <div className="grow ml-7 mt-4 h-1 bg-fill-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
      </div>
      {/* Expandable Section - iOS Settings style */}
      {hasExpandableContent && isExpanded && (
        <m.div
          className="overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={Spring.presets.smooth}
        >
          {/* Separator line */}
          <div className="h-px bg-border mx-3 sm:mx-4" />

          <div className="px-3 sm:px-4 py-3">
            {/* Additional trailing fields in iOS-style list */}
            {fieldGroups.trailing.length > 2 && (
              <div className="space-y-2 mb-3">
                {fieldGroups.trailing.slice(2).map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between py-1.5 min-h-[32px] gap-3"
                  >
                    <div className="flex items-center gap-2 text-sm text-text min-w-0 flex-1">
                      {field.icon && (
                        <i
                          className={cn(
                            'text-placeholder-text flex-shrink-0',
                            field.icon,
                          )}
                        />
                      )}
                      <span className="truncate">{field.label}</span>
                    </div>
                    <span className="text-sm font-mono tabular-nums text-placeholder-text flex-shrink-0 max-w-[120px] truncate text-right">
                      {renderField(field)?.props?.children || '-'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Tags section */}
            {nameData.tags && (
              <div className="space-y-2">
                {fieldGroups.trailing.length > 2 && (
                  <div className="h-px bg-border -mx-3 sm:-mx-4" />
                )}
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="i-mingcute-tag-line text-placeholder-text" />
                    <span className="text-sm text-text">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {nameData.tags
                      .split(',')
                      .filter(Boolean)
                      .map((tag) => (
                        <Tag key={tag.trim()} tag={tag.trim()} />
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </m.div>
      )}
      {/* Cell separator - iOS style */}
      <div className="h-px bg-border mx-3 sm:mx-4" />
    </m.div>
  )
}
