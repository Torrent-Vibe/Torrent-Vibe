import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import type { ModalComponent } from '~/components/ui/modal'
import { MultiSelect } from '~/components/ui/select'
import { useTorrentDataStore } from '~/modules/torrent/stores'

import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog/Dialog'

interface TagsSelectDialogProps {
  onClose: () => void
  onConfirm: (tags: string[]) => void
  currentTags?: string[]
  title?: string
}

const DEFAULT_TAGS: string[] = []

export const TagsSelectDialog: ModalComponent<TagsSelectDialogProps> = ({
  onClose,
  onConfirm,
  currentTags = DEFAULT_TAGS,
  title,
  dismiss,
}) => {
  const { t } = useTranslation()
  const tags = useTorrentDataStore((state) => state.tags)
  const [selectedTags, setSelectedTags] = useState<string[]>(currentTags)
  const dialogTitle = title || t('dialogs.tags.title')

  const tagOptions = useMemo(() => {
    return tags || []
  }, [tags])

  const handleConfirm = useCallback(() => {
    onConfirm(selectedTags)
    onClose()
    dismiss()
  }, [onConfirm, selectedTags, onClose, dismiss])

  const handleCancel = useCallback(() => {
    setSelectedTags(currentTags)
    onClose()
    dismiss()
  }, [currentTags, dismiss, onClose])

  const handleRemoveTag = useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{dialogTitle}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            {t('dialogs.tags.label')}
          </label>

          {/* Selected tags display */}
          {selectedTags.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="bg-fill text-text border border-border inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-text-secondary hover:text-text ml-1 inline-flex size-3 items-center justify-center rounded-full hover:bg-fill-secondary"
                  >
                    <i className="i-mingcute-close-line size-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <MultiSelect
            value={selectedTags}
            onChange={setSelectedTags}
            options={tagOptions}
            placeholder={t('dialogs.tags.placeholder')}
            allowCustom={true}
          />
        </div>

        <div className="text-sm text-text-secondary">
          {t('dialogs.tags.description')}
        </div>

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            {t('dialogs.tags.applyTags')}
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}
