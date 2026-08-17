import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  setDiscoverProviderEnabled,
  updateDiscoverProviderConfig,
  useDiscoverProviderConfig,
} from '~/atoms/settings/discover'
import { Button } from '~/components/ui/button'

import { SettingInputField, SettingSectionCard } from '../../components'

interface MikanFormState {
  baseUrl: string
}

export const MikanProviderSection = () => {
  const { t } = useTranslation('setting')
  const config = useDiscoverProviderConfig('mikan')
  const [form, setForm] = useState<MikanFormState>(() => ({
    baseUrl: config.baseUrl,
  }))

  useEffect(() => {
    setForm({
      baseUrl: config.baseUrl,
    })
  }, [config.baseUrl])

  const isDirty = useMemo(() => {
    return form.baseUrl.trim() !== config.baseUrl.trim()
  }, [config.baseUrl, form.baseUrl])

  const canSave = Boolean(form.baseUrl.trim())

  const handleSave = () => {
    if (!canSave) {
      return
    }

    updateDiscoverProviderConfig('mikan', {
      baseUrl: form.baseUrl.trim().replace(/\/$/, ''),
    })

    toast.success(t('discover.notifications.mikan.saved'))
  }

  return (
    <SettingSectionCard
      description={t('discover.providers.mikan.description')}
      enabled={config.enabled}
      title={t('discover.providers.mikan.title')}
      onToggleEnabled={(next) => {
        setDiscoverProviderEnabled('mikan', next)
        toast.success(
          next
            ? t('discover.notifications.mikan.enabled')
            : t('discover.notifications.mikan.disabled'),
        )
      }}
    >
      <SettingInputField
        autoComplete="off"
        description={t('discover.providers.mikan.baseUrl.description')}
        id="mikan-base-url"
        label={t('discover.providers.mikan.baseUrl.label')}
        placeholder="https://mikanani.me"
        spellCheck={false}
        value={form.baseUrl}
        onChange={(value) =>
          setForm((prev) => ({
            ...prev,
            baseUrl: value,
          }))
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="text-xs text-text-tertiary max-w-lg">
          {t('discover.providers.mikan.helper')}
        </div>

        <div className="flex items-center gap-2">
          <Button
            disabled={!isDirty}
            size="sm"
            variant="ghost"
            onClick={() => {
              setForm({
                baseUrl: config.baseUrl,
              })
            }}
          >
            {t('discover.actions.reset')}
          </Button>
          <Button
            disabled={!isDirty || !canSave}
            size="sm"
            onClick={handleSave}
          >
            {t('discover.actions.save')}
          </Button>
        </div>
      </div>
    </SettingSectionCard>
  )
}
