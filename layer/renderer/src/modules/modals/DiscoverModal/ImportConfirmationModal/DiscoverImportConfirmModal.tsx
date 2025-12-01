import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import type { ModalComponent } from '~/components/ui/modal'
import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'

import { useAddTorrentForm } from '../../AddTorrentModal/hooks/useAddTorrentForm'
import { TorrentBasicSettingsFields } from '../../AddTorrentModal/shared/components/TorrentBasicSettingsFields'
import { TorrentOptionToggle } from '../../AddTorrentModal/shared/components/TorrentOptionToggle'
import { useEnsureTorrentCategories } from '../../AddTorrentModal/shared/useEnsureTorrentCategories'
import type {
  TorrentFormData,
  TorrentFormHandlers,
} from '../../AddTorrentModal/types'
import type { ActionResult } from '../actions/types'

export interface DiscoverImportItemSummary {
  id: string
  title: string
  category?: string | null
}

interface DiscoverImportConfirmModalProps {
  mode: 'selected' | 'preview'
  items: DiscoverImportItemSummary[]
  onConfirm: (formData: TorrentFormData) => Promise<ActionResult>
}

export const DiscoverImportConfirmModal: ModalComponent<
  DiscoverImportConfirmModalProps
> = ({ mode, items, onConfirm, dismiss }) => {
  const { t } = useTranslation('app')
  const { formData, setFormData, categories } = useAddTorrentForm()
  const [isSubmitting, setIsSubmitting] = useState(false)
  useEnsureTorrentCategories(categories)

  const basicHandlers = useMemo<TorrentFormHandlers>(
    () => ({
      setFormData,
      handleFilesSelected: async () => {},
      removeFile: async () => {},
      loadMagnetPreview: async () => {},
      refreshFilePreview: async () => {},
      clearPreview: async () => {},
      toggleFileSelection: () => {},
      toggleAllFileSelections: () => {},
      previewState: { status: 'idle', files: [] },
      selectedFileIndices: new Set<number>(),
      isPreviewLoading: false,
    }),
    [setFormData],
  )

  const listTitle = useMemo(() => {
    if (mode === 'preview') {
      return t('discover.modal.previewTitle')
    }
    return t('discover.modal.resultCount', { count: items.length })
  }, [items.length, mode, t])

  const confirmLabel =
    mode === 'preview'
      ? t('discover.modal.importThis')
      : t('discover.modal.importSelected', { count: items.length })

  const handleConfirm = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    const result = await onConfirm(formData)
    if (result.ok) {
      dismiss()
      return
    }
    setIsSubmitting(false)
  }

  return (
    <div className="flex flex-col h-full min-w-0">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <i className="i-mingcute-upload-3-line text-white text-sm" />
          </div>
          <span>
            {mode === 'preview'
              ? t('discover.modal.importThis')
              : t('discover.modal.importSelected', { count: items.length })}
          </span>
        </DialogTitle>
        <DialogDescription className="text-text-secondary">
          {t('addTorrent.settingsPanel.description')}
        </DialogDescription>
      </DialogHeader>

      <DialogClose />

      <div className="flex-1 min-h-0 flex flex-col gap-6 py-2">
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-text">{listTitle}</h3>
          <ScrollArea
            rootClassName="max-h-52 border border-border/60 rounded-md"
            viewportClassName="px-3 py-2"
          >
            <ul className="flex flex-col gap-2 text-sm text-text-secondary">
              {items.map((item) => (
                <li key={item.id} className="flex flex-col min-w-0">
                  <span className="text-text font-medium line-clamp-5">
                    {item.title}
                  </span>
                  {item.category ? (
                    <span className="text-xs text-text-tertiary">
                      {item.category}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </section>

        <section className="space-y-4">
          <TorrentBasicSettingsFields
            formData={formData}
            handlers={basicHandlers}
            categories={categories}
            showRename={false}
          />

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text">
              {t('addTorrent.settingsPanel.options')}
            </h3>
            <div className="space-y-3">
              <TorrentOptionToggle
                id="auto-tmm"
                checked={!!formData.autoTMM}
                onChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    autoTMM: checked,
                  }))
                }
                label={t('addTorrent.settingsPanel.autoTMM')}
              />
              <TorrentOptionToggle
                id="start-torrent"
                checked={formData.startTorrent}
                onChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    startTorrent: checked,
                  }))
                }
                label={t('addTorrent.settingsPanel.startTorrent')}
              />
            </div>
          </div>
        </section>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="min-w-[120px]"
          onClick={handleConfirm}
          isLoading={isSubmitting}
          loadingText={t('modals.addTorrent.addingText')}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </div>
  )
}

DiscoverImportConfirmModal.contentClassName = 'max-w-[520px]'
