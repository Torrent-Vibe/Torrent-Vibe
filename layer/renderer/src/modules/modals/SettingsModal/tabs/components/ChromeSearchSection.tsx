import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { ipcServices } from '~/lib/ipc-client'

import { SettingField, SettingInputField, SettingSectionCard } from '.'

export const ChromeSearchSection = () => {
  const { t } = useTranslation('setting')
  const [currentPath, setCurrentPath] = useState('')
  const [initialPath, setInitialPath] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)

  useEffect(() => {
    if (!ELECTRON) {
      setLoading(false)
      return
    }
    let mounted = true
    setLoading(true)
    ipcServices?.appSettings
      .getSearchSettings()
      .then((settings) => {
        if (!mounted) return
        const path = settings?.chromeExecutablePath ?? ''
        setCurrentPath(path)
        setInitialPath(path)
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const trimmedCurrentPath = useMemo(() => currentPath.trim(), [currentPath])

  const trimmedInitialPath = useMemo(() => initialPath.trim(), [initialPath])

  const hasChanges = trimmedCurrentPath !== trimmedInitialPath

  const submitPath = async (pathValue: string) => {
    if (!ELECTRON) return
    setSaving(true)
    try {
      const result = await ipcServices?.appSettings.setChromeExecutablePath({
        chromeExecutablePath: pathValue.trim() || null,
      })

      if (!result?.ok) {
        switch (result?.error) {
          case 'notFound': {
            toast.error(t('desktop.chromeSearch.messages.pathMissing'))
            break
          }
          case 'notFile': {
            toast.error(t('desktop.chromeSearch.messages.pathNotFile'))
            break
          }
          case 'notAccessible': {
            toast.error(t('desktop.chromeSearch.messages.pathNotAccessible'))
            break
          }
          default: {
            toast.error(t('desktop.chromeSearch.messages.saveFailed'))
            break
          }
        }
        return false
      }

      const normalized = result.chromeExecutablePath ?? ''
      setInitialPath(normalized)
      setCurrentPath(normalized)
      toast.success(t('desktop.chromeSearch.messages.saved'))
      return true
    } catch (error) {
      toast.error(
        t('desktop.chromeSearch.messages.saveFailedWithReason', {
          reason: String((error as Error)?.message ?? error),
        }),
      )
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    await submitPath(trimmedCurrentPath)
  }

  const handleDetect = async () => {
    if (!ELECTRON) return
    setDetecting(true)
    try {
      const { chromeExecutablePath } =
        (await ipcServices?.appSettings.detectChromeExecutable()) ?? {}
      if (chromeExecutablePath) {
        setCurrentPath(chromeExecutablePath)
        toast.success(
          t('desktop.chromeSearch.messages.detected', {
            path: chromeExecutablePath,
          }),
        )
      } else {
        toast.error(t('desktop.chromeSearch.messages.detectFailed'))
      }
    } catch (error) {
      toast.error(
        t('desktop.chromeSearch.messages.detectFailedWithReason', {
          reason: String((error as Error)?.message ?? error),
        }),
      )
    } finally {
      setDetecting(false)
    }
  }

  const handleClear = async () => {
    await submitPath('')
  }

  return (
    <SettingSectionCard
      title={t('desktop.chromeSearch.title')}
      description={t('desktop.chromeSearch.description')}
    >
      <SettingInputField
        id="chrome-search-path"
        label={t('desktop.chromeSearch.path.label')}
        description={t('desktop.chromeSearch.path.description')}
        placeholder={t('desktop.chromeSearch.path.placeholder')}
        value={currentPath}
        onChange={setCurrentPath}
        disabled={!ELECTRON || loading}
      />
      <SettingField
        label={t('desktop.chromeSearch.actions.label')}
        description={t('desktop.chromeSearch.actions.help')}
        controlAlign="start"
      >
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!ELECTRON || detecting}
            onClick={handleDetect}
          >
            {detecting
              ? t('desktop.chromeSearch.actions.detecting')
              : t('desktop.chromeSearch.actions.detect')}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={
              !ELECTRON || saving || (!hasChanges && !trimmedCurrentPath)
            }
            onClick={handleSave}
          >
            {saving
              ? t('desktop.chromeSearch.actions.saving')
              : t('desktop.chromeSearch.actions.save')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={
              !ELECTRON ||
              loading ||
              saving ||
              (!trimmedCurrentPath && !trimmedInitialPath)
            }
            onClick={handleClear}
          >
            {t('desktop.chromeSearch.actions.clear')}
          </Button>
        </div>
      </SettingField>
    </SettingSectionCard>
  )
}
