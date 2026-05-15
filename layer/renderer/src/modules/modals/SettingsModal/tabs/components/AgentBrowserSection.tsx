import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { ipcServices } from '~/lib/ipc-client'

import { SettingField, SettingInputField, SettingSectionCard } from '.'

export const AgentBrowserSection = () => {
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
        if (!mounted) {
          return
        }
        const path = settings?.agentBrowserPath ?? ''
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
    if (!ELECTRON) {
      return
    }
    setSaving(true)
    try {
      const result = await ipcServices?.appSettings.setAgentBrowserPath({
        agentBrowserPath: pathValue.trim() || null,
      })

      if (!result?.ok) {
        switch (result?.error) {
          case 'notFound': {
            toast.error(t('desktop.agentBrowser.messages.pathMissing'))
            break
          }
          case 'notFile': {
            toast.error(t('desktop.agentBrowser.messages.pathNotFile'))
            break
          }
          case 'notAccessible': {
            toast.error(t('desktop.agentBrowser.messages.pathNotAccessible'))
            break
          }
          default: {
            toast.error(t('desktop.agentBrowser.messages.saveFailed'))
            break
          }
        }
        return false
      }

      const normalized = result.agentBrowserPath ?? ''
      setInitialPath(normalized)
      setCurrentPath(normalized)
      toast.success(t('desktop.agentBrowser.messages.saved'))
      return true
    } catch (error) {
      toast.error(
        t('desktop.agentBrowser.messages.saveFailedWithReason', {
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
    if (!ELECTRON) {
      return
    }
    setDetecting(true)
    try {
      const { agentBrowserPath } =
        (await ipcServices?.appSettings.detectAgentBrowser()) ?? {}
      if (agentBrowserPath) {
        setCurrentPath(agentBrowserPath)
        toast.success(
          t('desktop.agentBrowser.messages.detected', {
            path: agentBrowserPath,
          }),
        )
      } else {
        toast.error(t('desktop.agentBrowser.messages.detectFailed'))
      }
    } catch (error) {
      toast.error(
        t('desktop.agentBrowser.messages.detectFailedWithReason', {
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
      title={t('desktop.agentBrowser.title')}
      description={t('desktop.agentBrowser.description')}
    >
      <SettingInputField
        id="agent-browser-path"
        label={t('desktop.agentBrowser.path.label')}
        description={t('desktop.agentBrowser.path.description')}
        placeholder={t('desktop.agentBrowser.path.placeholder')}
        value={currentPath}
        onChange={setCurrentPath}
        disabled={!ELECTRON || loading}
      />
      <SettingField
        label={t('desktop.agentBrowser.actions.label')}
        description={t('desktop.agentBrowser.actions.help')}
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
              ? t('desktop.agentBrowser.actions.detecting')
              : t('desktop.agentBrowser.actions.detect')}
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
              ? t('desktop.agentBrowser.actions.saving')
              : t('desktop.agentBrowser.actions.save')}
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
            {t('desktop.agentBrowser.actions.clear')}
          </Button>
        </div>
      </SettingField>
    </SettingSectionCard>
  )
}
