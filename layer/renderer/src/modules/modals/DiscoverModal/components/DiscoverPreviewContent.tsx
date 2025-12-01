import { useMemo } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'

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

  const handleImport = () => {
    void importingSlice.importPreview()
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
                title={t('discover.modal.detailOriginalFilename')}
                originFileName={previewModel.originFileName}
              />
            )}

            {previewModel.links.length > 0 && (
              <PreviewLinks
                title={t('discover.modal.detailLinks')}
                links={previewModel.links}
              />
            )}

            {previewModel.screenshots.length > 0 && (
              <PreviewScreenshots
                title={t('discover.modal.detailScreenshots')}
                screenshots={previewModel.screenshots}
              />
            )}

            {previewModel.description && (
              <ErrorBoundary
                fallback={
                  <div className="p-2">Preview description render error.</div>
                }
              >
                <PreviewDescription
                  title={t('discover.modal.detailDescription')}
                  content={previewModel.description}
                  renderer={previewModel.descriptionRenderer}
                />
              </ErrorBoundary>
            )}

            {previewModel.files.length > 0 && (
              <PreviewFiles
                title={t('discover.modal.detailFiles')}
                files={previewModel.files}
                overflowLabel={previewModel.filesOverflowLabel}
              />
            )}

            {previewModel.mediainfo && (
              <PreviewMediainfo
                title={t('discover.modal.detailMediaInfo')}
                mediainfo={previewModel.mediainfo}
              />
            )}
          </div>

          <Button
            variant="primary"
            className="w-full @[640px]:w-auto @[640px]:self-end @[640px]:px-6 @[640px]:min-w-[200px]"
            onClick={handleImport}
            disabled={disableImport}
          >
            {importing && (
              <i className="i-mingcute-loading-3-line mr-2 animate-spin" />
            )}
            <span>{importLabel}</span>
          </Button>
        </>
      )}
    </div>
  )
}
