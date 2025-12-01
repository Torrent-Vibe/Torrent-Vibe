import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import type { ModalComponent } from '~/components/ui/modal'
import { getI18n } from '~/i18n'
import { ipcServices } from '~/lib/ipc-client'

import { exportAppSettingsAsString } from './app-settings-data'

export const AppSettingsExportModal: ModalComponent = ({ dismiss }) => {
  const { t } = useTranslation('setting')
  const [exportJson, setExportJson] = useState('')
  const [isLoading, setLoading] = useState(true)
  const [isSaving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        const json = await exportAppSettingsAsString()
        if (!active) return
        setExportJson(json)
      } catch (error) {
        console.error('Failed to export settings', error)
        toast.error(getI18n().t('messages.settingsExportFailed'))
        dismiss()
      } finally {
        if (active) setLoading(false)
      }
    }

    run().catch(() => {})
    return () => {
      active = false
    }
  }, [dismiss])

  const handleCopy = async () => {
    if (!exportJson) return
    try {
      await navigator.clipboard.writeText(exportJson)
      toast.success(getI18n().t('messages.copiedToClipboard'))
    } catch {
      toast.error(getI18n().t('messages.copyFailed'))
    }
  }

  const handleSaveToDisk = async () => {
    if (!exportJson) return
    setSaving(true)
    try {
      const timestamp = new Date().toISOString().replaceAll(':', '-')
      const filename = `torrent-vibe-settings-${timestamp}.json`

      if (ELECTRON && ipcServices?.fileSystem?.saveTextFile) {
        // Electron environment - use existing IPC method
        const result = await ipcServices?.fileSystem?.saveTextFile?.({
          title: t('general.dataManagement.exportModal.saveDialogTitle'),
          defaultPath: filename,
          filters: [
            { name: 'JSON', extensions: ['json'] },
            {
              name: t('general.dataManagement.exportModal.allFilesFilter'),
              extensions: ['*'],
            },
          ],
          content: exportJson,
        })

        if (!result || result.canceled) {
          return
        }
      } else {
        // Web environment - use download attribute
        const blob = new Blob([exportJson], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.append(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
      }

      toast.success(getI18n().t('messages.settingsExportSaved'))
    } catch (error) {
      console.error('Failed to save settings export', error)
      toast.error(getI18n().t('messages.settingsExportSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-text">
        {t('general.dataManagement.exportModal.title')}
      </h3>
      <p className="text-sm text-text-secondary">
        {t('general.dataManagement.exportModal.description')}
      </p>
      {isLoading ? (
        <div className="flex items-center justify-center rounded-md border border-dashed border-border py-12 text-sm text-text-secondary">
          <i className="i-mingcute-loading-3-line mr-2 animate-spin" />
          {t('general.dataManagement.loading')}
        </div>
      ) : (
        <textarea
          className="relative resize-none font-mono block w-full appearance-none rounded-md border px-2.5 py-2 shadow-xs outline-hidden transition sm:text-sm border-border text-text placeholder:text-placeholder-text bg-background"
          rows={14}
          readOnly
          value={exportJson}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSaveToDisk}
          disabled={isLoading || isSaving}
          isLoading={isSaving}
        >
          {t('general.dataManagement.actions.saveToDisk')}
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={handleCopy}
          disabled={isLoading}
        >
          {t('general.dataManagement.actions.copy')}
        </Button>
      </div>
    </div>
  )
}
