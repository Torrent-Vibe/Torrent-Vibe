import { useMemo } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { cn } from '~/lib/cn'

import { DiscoverModalActions } from '../actions'
import { useDiscoverModalStore } from '../store'
import { useBuildPreviewModel } from './discoverPreviewModel'
import {
  PreviewDescription,
  PreviewFiles,
  PreviewHero,
  PreviewLinks,
  PreviewMediainfo,
  PreviewOriginFile,
  PreviewScreenshots,
} from './DiscoverPreviewSections'

interface DiscoverPreviewContentProps {
  className?: string
}

export const DiscoverPreviewContent = ({
  className,
}: DiscoverPreviewContentProps) => {
  const { t } = useTranslation('app')
  const actions = DiscoverModalActions.shared
  const { importing: importingSlice } = actions.slices

  const previewId = useDiscoverModalStore((state) => state.previewId)
  const previewDetail = useDiscoverModalStore((state) => state.previewDetail)
  const selectedIds = useDiscoverModalStore((state) => state.selectedIds)
  const isPreviewLoading = useDiscoverModalStore(
    (state) => state.isPreviewLoading,
  )
  const previewError = useDiscoverModalStore((state) => state.previewError)
  const importing = useDiscoverModalStore((state) => state.importing)
  const descriptionRenderer = useDiscoverModalStore(
    (state) => state.previewDescriptionRenderer,
  )

  const loadingLabel = t('discover.modal.loading')
  const importLabel = t('discover.modal.importThis')
  const selectedCount = selectedIds.size
  const importAllLabel = t('discover.modal.importAll', {
    count: selectedCount,
  })

  const buildPreviewModel = useBuildPreviewModel()
  const previewModel = useMemo(
    () =>
      previewDetail
        ? buildPreviewModel(previewDetail, {
            descriptionRenderer,
          })
        : null,
    [previewDetail, buildPreviewModel, descriptionRenderer],
  )

  const disableImport = importing || !previewId
  const showImportAll = selectedCount > 1
  const disableImportAll = importing || selectedCount === 0

  const handleImport = () => {
    importingSlice.importPreview()
  }

  const handleImportAll = () => {
    importingSlice.importSelected().then((result) => {
      if (result.error === 'providerNotReady') {
        toast.error(t('discover.messages.providerNotReady'))
      } else if (result.error === 'selectionEmpty') {
        toast.error(t('discover.messages.importFailed'))
      }
    })
  }

  return (
    <div
      className={cn(
        'flex flex-1 flex-col gap-3 text-sm @container',
        '@[420px]:gap-3.5',
        '@[520px]:gap-4 @[520px]:text-[13px] @[520px]:leading-relaxed',
        '@[640px]:text-sm',
        className,
      )}
    >
      {isPreviewLoading && (
        <div className="flex items-center gap-2 text-text-tertiary">
          <i className="i-mingcute-loading-3-line animate-spin" />
          <span>{loadingLabel}</span>
        </div>
      )}

      {previewError && !isPreviewLoading && (
        <div className="rounded border border-border/70 bg-background-secondary/60 px-3 py-2 text-xs text-text-tertiary">
          {t('discover.messages.previewFailed')}
        </div>
      )}

      {previewModel && (
        <>
          <div
            className={cn(
              'flex flex-col gap-4',
              '@[480px]:gap-5',
              '@[840px]:grid @[840px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @[840px]:items-start @[840px]:gap-x-6 @[840px]:gap-y-6',
            )}
          >
            <PreviewHero data={previewModel.hero} />

            {previewModel.originFileName && (
              <PreviewOriginFile
                originFileName={previewModel.originFileName}
                title={t('discover.modal.detailOriginalFilename')}
              />
            )}

            {previewModel.links.length > 0 && (
              <PreviewLinks
                links={previewModel.links}
                title={t('discover.modal.detailLinks')}
              />
            )}

            {previewModel.screenshots.length > 0 && (
              <PreviewScreenshots
                screenshots={previewModel.screenshots}
                title={t('discover.modal.detailScreenshots')}
              />
            )}

            {previewModel.description && (
              <ErrorBoundary
                fallback={
                  <div className="p-2">Preview description render error.</div>
                }
              >
                <PreviewDescription
                  content={previewModel.description}
                  renderer={previewModel.descriptionRenderer}
                  title={t('discover.modal.detailDescription')}
                />
              </ErrorBoundary>
            )}

            {previewModel.files.length > 0 && (
              <PreviewFiles
                files={previewModel.files}
                overflowLabel={previewModel.filesOverflowLabel}
                title={t('discover.modal.detailFiles')}
              />
            )}

            {previewModel.mediainfo && (
              <PreviewMediainfo
                mediainfo={previewModel.mediainfo}
                title={t('discover.modal.detailMediaInfo')}
              />
            )}
          </div>

          <div className="flex flex-col gap-2 w-full @[640px]:w-auto @[640px]:self-end @[640px]:flex-row @[640px]:justify-end">
            {showImportAll && (
              <Button
                className="w-full @[640px]:w-auto @[640px]:px-6 @[640px]:min-w-[200px]"
                disabled={disableImportAll}
                variant="secondary"
                onClick={handleImportAll}
              >
                {importing && (
                  <i className="i-mingcute-loading-3-line mr-2 animate-spin" />
                )}
                <span>{importAllLabel}</span>
              </Button>
            )}

            <Button
              className="w-full @[640px]:w-auto @[640px]:px-6 @[640px]:min-w-[200px]"
              disabled={disableImport}
              variant="primary"
              onClick={handleImport}
            >
              {importing && (
                <i className="i-mingcute-loading-3-line mr-2 animate-spin" />
              )}
              <span>{importLabel}</span>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
