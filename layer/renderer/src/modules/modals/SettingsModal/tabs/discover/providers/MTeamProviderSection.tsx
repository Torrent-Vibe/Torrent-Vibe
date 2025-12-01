import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  setDiscoverProviderEnabled,
  updateDiscoverProviderConfig,
  useDiscoverProviderConfig,
} from '~/atoms/settings/discover'
import { Button } from '~/components/ui/button'
import {
  MTEAM_FILTER_DEFINITIONS_MODES,
} from '~/modules/discover/providers/mteam'

import {
  SettingInputField,
  SettingSectionCard,
  SettingSelectField,
} from '../../components'

interface MTeamFormState {
  baseUrl: string
  apiKey: string
  mode: string
  pageSize: string
}

export const MTeamProviderSection = () => {
  const { t } = useTranslation('setting')
  const config = useDiscoverProviderConfig('mteam')
  const [form, setForm] = useState<MTeamFormState>(() => ({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    mode: config.mode ?? 'normal',
    pageSize: config.pageSize.toString(),
  }))

  useEffect(() => {
    setForm({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      mode: config.mode ?? 'normal',
      pageSize: config.pageSize.toString(),
    })
  }, [config.apiKey, config.baseUrl, config.mode, config.pageSize])

  const isDirty = useMemo(() => {
    return (
      form.baseUrl.trim() !== config.baseUrl.trim() ||
      form.apiKey.trim() !== config.apiKey.trim() ||
      form.mode !== (config.mode ?? 'normal') ||
      Number(form.pageSize) !== config.pageSize
    )
  }, [config.apiKey, config.baseUrl, config.mode, config.pageSize, form])

  const canSave =
    Boolean(form.baseUrl.trim()) &&
    Boolean(form.apiKey.trim()) &&
    Number(form.pageSize) > 0

  const handleSave = () => {
    if (!canSave) return

    updateDiscoverProviderConfig('mteam', {
      baseUrl: form.baseUrl.trim().replace(/\/$/, ''),
      apiKey: form.apiKey.trim(),
      mode: form.mode,
      pageSize: Number(form.pageSize) || config.pageSize,
    })

    toast.success(t('discover.notifications.saved'))
  }

  return (
    <SettingSectionCard
      title={t('discover.providers.mteam.title')}
      description={t('discover.providers.mteam.description')}
      enabled={config.enabled}
      onToggleEnabled={(next) => {
        setDiscoverProviderEnabled('mteam', next)
        toast.success(
          next
            ? t('discover.notifications.enabled')
            : t('discover.notifications.disabled'),
        )
      }}
    >
      <SettingInputField
        id="mteam-base-url"
        label={t('discover.providers.mteam.baseUrl.label')}
        description={t('discover.providers.mteam.baseUrl.description')}
        value={form.baseUrl}
        onChange={(value) =>
          setForm((prev) => ({
            ...prev,
            baseUrl: value,
          }))
        }
        placeholder="https://api.m-team.cc/api"
        spellCheck={false}
        autoComplete="off"
      />

      <SettingSelectField
        id="mteam-mode"
        label={t('discover.providers.mteam.mode.label')}
        value={form.mode}
        onValueChange={(value) =>
          setForm((prev) => ({
            ...prev,
            mode: value,
          }))
        }
        options={MTEAM_FILTER_DEFINITIONS_MODES.map((option) => ({
          value: option.value,
          label: t(option.label),
        }))}
      />

      <SettingInputField
        id="mteam-api-key"
        label={t('discover.providers.mteam.apiKey.label')}
        description={t('discover.providers.mteam.apiKey.description')}
        value={form.apiKey}
        onChange={(value) =>
          setForm((prev) => ({
            ...prev,
            apiKey: value,
          }))
        }
        type="password"
        autoComplete="off"
      />

      <SettingInputField
        id="mteam-page-size"
        label={t('discover.providers.mteam.pageSize.label')}
        description={t('discover.providers.mteam.pageSize.description')}
        value={form.pageSize}
        onChange={(value) =>
          setForm((prev) => ({
            ...prev,
            pageSize: value.replaceAll(/\D/g, ''),
          }))
        }
        inputMode="numeric"
        min={1}
        max={100}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="text-xs text-text-tertiary max-w-lg">
          {t('discover.providers.mteam.helper')}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setForm({
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                mode: config.mode ?? 'normal',
                pageSize: config.pageSize.toString(),
              })
            }}
            disabled={!isDirty}
          >
            {t('discover.actions.reset')}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || !canSave}
          >
            {t('discover.actions.save')}
          </Button>
        </div>
      </div>
    </SettingSectionCard>
  )
}
