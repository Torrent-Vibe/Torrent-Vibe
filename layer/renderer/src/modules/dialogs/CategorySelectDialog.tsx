import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ModalComponent } from '~/components/ui/modal'
import { ComboboxSelect } from '~/components/ui/select'
import { useTorrentDataStore } from '~/modules/torrent/stores'

import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog/Dialog'

interface CategorySelectDialogProps {
  onConfirm: (category: string) => void
  currentCategory?: string
  title?: string
}

export const CategorySelectDialog: ModalComponent<
  CategorySelectDialogProps
> = ({ onConfirm, currentCategory: initialCategory = '', title }) => {
  const [selectedCategory, setSelectedCategory] = useState(initialCategory)
  const { t } = useTranslation()
  const categories = useTorrentDataStore((state) => state.categories)
  const dialogTitle = title || t('dialogs.category.title')

  const categoryOptions = useMemo(() => {
    if (!categories) return ['']
    return ['', ...Object.keys(categories)]
  }, [categories])

  const handleConfirm = useCallback(
    (category: string) => {
      onConfirm(category)
      setSelectedCategory(category)
    },
    [onConfirm],
  )

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{dialogTitle}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <ComboboxSelect
          value={selectedCategory}
          onValueChange={handleConfirm}
          options={categoryOptions}
          placeholder={t('dialogs.category.placeholder')}
          allowCustom={true}
          label={t('dialogs.category.label')}
        />

        <div className="text-sm text-text-secondary">
          {t('dialogs.category.description')}
        </div>
      </div>
    </DialogContent>
  )
}
