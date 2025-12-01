import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox/Checkbox'
import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import { formatBytes } from '~/lib/format'

import {
  getPreviewFileMetrics,
  getPreviewSelectionSummary,
} from '../shared/preview-helpers'
import type { TorrentContentPreviewState } from '../types'

export interface TorrentContentPreviewProps {
  state: TorrentContentPreviewState
  selectedFileIndices: Set<number>
  onToggleFile: (index: number, next?: boolean) => void
  onToggleAll: (select: boolean) => void
  onReload?: () => Promise<void> | void
  onClear?: () => Promise<void> | void
  isLoading?: boolean
}

export const TorrentContentPreview = ({
  state,
  selectedFileIndices,
  onToggleFile,
  onToggleAll,
  onReload,
  onClear,
  isLoading,
}: TorrentContentPreviewProps) => {
  const { t } = useTranslation()

  const { totalFiles, totalSize } = useMemo(
    () => getPreviewFileMetrics(state),
    [state],
  )

  const selectedSummary = useMemo(
    () => getPreviewSelectionSummary(state, selectedFileIndices),
    [selectedFileIndices, state],
  )

  const allSelected =
    totalFiles > 0 && selectedSummary.selectedCount === totalFiles
  const isIndeterminate =
    selectedSummary.selectedCount > 0 &&
    selectedSummary.selectedCount < totalFiles

  if (state.status === 'idle') return null

  if (state.status === 'loading') {
    return (
      <div className="rounded-lg border border-border/60 bg-fill/40 p-4 text-xs text-text-secondary">
        {t('addTorrent.preview.loading')}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-fill/40 p-4 text-xs text-red">
        <span>{state.error || t('addTorrent.preview.error')}</span>
        <div className="flex items-center gap-2">
          {onReload && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                onReload()
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
                onClear()
              }}
            >
              {t('addTorrent.preview.clear')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col gap-3 rounded-lg border border-border/60 bg-fill/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1 text-xs text-text-secondary">
          {state.name && (
            <div className="truncate font-medium text-text" title={state.name}>
              {state.name}
            </div>
          )}
          <div>
            {t('addTorrent.preview.selectionSummary', {
              selected: selectedSummary.selectedCount,
              total: totalFiles,
              selectedSize: formatBytes(selectedSummary.selectedSize),
              totalSize: formatBytes(totalSize),
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            size="sm"
            checked={allSelected}
            indeterminate={isIndeterminate}
            onCheckedChange={(checked) => onToggleAll(Boolean(checked))}
            aria-label={
              allSelected
                ? t('addTorrent.preview.deselectAll')
                : t('addTorrent.preview.selectAll')
            }
          />
          {onReload && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                onReload()
              }}
              disabled={isLoading}
              isLoading={isLoading}
            >
              {t('addTorrent.preview.reload')}
            </Button>
          )}
          {onClear && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onClear()
              }}
            >
              {t('addTorrent.preview.clear')}
            </Button>
          )}
        </div>
      </div>

      <ScrollArea
        flex
        rootClassName="h-[min(60vh,480px)] -mx-4"
        viewportClassName="px-4"
      >
        <div className="space-y-2">
          {state.files.map((file) => {
            const selected = selectedFileIndices.has(file.index)
            return (
              <label
                key={`${file.index}-${file.path}`}
                className="flex items-start gap-3 rounded-md bg-background px-3 py-2 text-xs"
              >
                <Checkbox
                  size="sm"
                  checked={selected}
                  onCheckedChange={(checked) =>
                    onToggleFile(file.index, Boolean(checked))
                  }
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="truncate font-medium text-text"
                    title={file.path}
                  >
                    {file.path}
                  </div>
                  <div className="text-text-secondary">
                    {formatBytes(file.size ?? 0)}
                  </div>
                </div>
              </label>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
