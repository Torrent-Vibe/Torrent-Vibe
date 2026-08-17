import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { formatBytes } from '~/lib/format'

import {
  getPreviewFileMetrics,
  getPreviewSelectionSummary,
} from '../shared/preview-helpers'
import type { TorrentContentPreviewState } from '../types'

interface TorrentPreviewSummaryProps {
  isLoading?: boolean
  onClear?: () => Promise<void> | void
  onOpenPreview: () => void
  onReload?: () => Promise<void> | void
  selectedFileIndices: Set<number>
  state: TorrentContentPreviewState
}

export const TorrentPreviewSummary = ({
  state,
  selectedFileIndices,
  onOpenPreview,
  onReload,
  onClear,
  isLoading,
}: TorrentPreviewSummaryProps) => {
  const { t } = useTranslation()

  const { totalFiles, totalSize } = useMemo(
    () => getPreviewFileMetrics(state),
    [state],
  )

  const selection = useMemo(
    () => getPreviewSelectionSummary(state, selectedFileIndices),
    [state, selectedFileIndices],
  )

  if (state.status === 'idle') {
    return null
  }

  if (state.status === 'loading') {
    return (
      <div className="rounded-lg border border-border/60 bg-fill/40 px-4 py-3 flex items-center justify-between gap-3 text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <i className="i-mingcute-loading-3-line animate-spin" />
          <span>{t('addTorrent.preview.loading')}</span>
        </div>
        {onClear && (
          <Button
            disabled={isLoading}
            size="sm"
            variant="ghost"
            onClick={() => {
              void onClear()
            }}
          >
            {t('addTorrent.preview.clear')}
          </Button>
        )}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 flex items-start justify-between gap-3 text-xs">
        <div className="flex items-start gap-2 text-red min-w-0">
          <i className="i-mingcute-warning-line mt-[2px]" />
          <span
            className="truncate"
            title={state.error || t('addTorrent.preview.error')}
          >
            {state.error || t('addTorrent.preview.error')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onReload && (
            <Button
              disabled={isLoading}
              isLoading={isLoading}
              size="sm"
              variant="secondary"
              onClick={() => {
                void onReload()
              }}
            >
              {t('addTorrent.preview.retry')}
            </Button>
          )}
          {onClear && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void onClear()
              }}
            >
              {t('addTorrent.preview.clear')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  const selectedLabel = t('addTorrent.preview.selectionSummary', {
    selected: selection.selectedCount,
    total: totalFiles,
    selectedSize: formatBytes(selection.selectedSize),
    totalSize: formatBytes(totalSize),
  })

  const displayName = state.displayName || state.name

  return (
    <div className="rounded-lg border border-border/60 bg-fill/40 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs font-medium text-text">
          <i className="i-lucide-file text-base text-accent" />
          <span className="truncate" title={displayName || undefined}>
            {displayName || t('addTorrent.preview.title')}
          </span>
        </div>
        <p className="text-xs text-text-secondary mt-1">{selectedLabel}</p>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-center">
        <Button
          className="-mr-3"
          disabled={totalFiles === 0}
          size="sm"
          type="button"
          variant="ghost"
          onClick={onOpenPreview}
        >
          <i className="i-mingcute-eye-2-line mr-1" />
          {t('addTorrent.preview.openModal')}
        </Button>
      </div>
    </div>
  )
}
