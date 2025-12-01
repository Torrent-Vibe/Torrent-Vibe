import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import type { ModalComponent } from '~/components/ui/modal'
import { getI18n } from '~/i18n'

import { importAppSettings } from './app-settings-data'

interface AppSettingsImportModalProps {
  onImported?: () => void
}

export const AppSettingsImportModal: ModalComponent<
  AppSettingsImportModalProps
> = ({ dismiss, onImported }) => {
  const { t } = useTranslation('setting')
  const [text, setText] = useState('')
  const [isImporting, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canImport = text.trim().length > 0 && !isImporting

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.json')) {
      toast.error(
        t('general.dataManagement.importModal.errors.invalidFileType'),
      )
      return
    }

    try {
      const fileContent = await file.text()
      setText(fileContent)
    } catch (error) {
      console.error('Failed to read file', error)
      toast.error(t('general.dataManagement.importModal.errors.fileReadFailed'))
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleImport = async () => {
    try {
      setImporting(true)
      await importAppSettings(text)
      toast.success(getI18n().t('messages.settingsImported'))
      onImported?.()
      dismiss()
    } catch (error) {
      console.error('Failed to import settings', error)
      toast.error(getI18n().t('messages.settingsImportFailed'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-text">
        {t('general.dataManagement.importModal.title')}
      </h3>
      <p className="text-sm text-text-secondary">
        {t('general.dataManagement.importModal.description')}
      </p>

      <textarea
        className="relative resize-none block font-mono w-full appearance-none rounded-md border px-2.5 py-2 shadow-xs outline-hidden transition sm:text-sm border-border text-text placeholder:text-placeholder-text bg-background"
        placeholder={t('general.dataManagement.importModal.placeholder')}
        rows={10}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      <p className="text-xs text-text-secondary">
        {t('general.dataManagement.importModal.notice')}
      </p>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex justify-between gap-2">
        <Button size="sm" variant="secondary" onClick={handleUploadClick}>
          {t('general.dataManagement.importModal.uploadFile')}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={handleImport}
          disabled={!canImport}
          isLoading={isImporting}
        >
          {t('general.dataManagement.actions.import')}
        </Button>
      </div>
    </div>
  )
}
