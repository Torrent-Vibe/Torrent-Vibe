import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import type {
  ModalComponent,
  ModalComponentProps,
} from '~/components/ui/modal/types'

import type { TorrentContentPreviewProps } from './TorrentContentPreview'
import { TorrentContentPreview } from './TorrentContentPreview'

type TorrentPreviewDialogOwnProps = TorrentContentPreviewProps & {
  onDismiss?: () => void
}

type TorrentPreviewDialogProps = TorrentPreviewDialogOwnProps &
  ModalComponentProps

export const TorrentPreviewDialog: ModalComponent<
  TorrentPreviewDialogOwnProps
> = (props: TorrentPreviewDialogProps) => {
  const { t } = useTranslation()
  const {
    dismiss,
    modalId: _modalId,
    state,
    selectedFileIndices,
    onToggleFile,
    onToggleAll,
    onReload,
    onClear,
    isLoading,
    onDismiss,
  } = props

  useEffect(() => {
    return () => {
      onDismiss?.()
    }
  }, [onDismiss])

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('addTorrent.preview.title')}</DialogTitle>
        <DialogDescription className="text-text-secondary">
          {t('addTorrent.preview.modalDescription')}
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <TorrentContentPreview
          state={state}
          selectedFileIndices={selectedFileIndices}
          onToggleFile={onToggleFile}
          onToggleAll={onToggleAll}
          onReload={onReload}
          onClear={onClear}
          isLoading={isLoading}
        />

        {state.source === 'file' && state.status !== 'error' && (
          <p className="text-xs text-text-secondary">
            {t('addTorrent.preview.fileHint')}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button size="sm" variant="secondary" onClick={dismiss}>
          {t('buttons.close')}
        </Button>
      </DialogFooter>
    </>
  )
}

TorrentPreviewDialog.contentClassName =
  'w-[min(90vw,900px)] max-w-3xl max-h-[min(80vh,680px)] flex flex-col gap-4 overflow-hidden'
TorrentPreviewDialog.showCloseButton = true
