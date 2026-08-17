import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useQBittorrentPrefsManager } from '~/atoms/settings/qbittorrent-prefs'
import { Input } from '~/components/ui/input'
import { getI18n } from '~/i18n'

import {
  PrefsTabLayout,
  SettingField,
  SettingSectionCard,
  SettingSelectField,
  SettingSwitchField,
} from './components'

export const SpeedTab = () => {
  const { t } = useTranslation('setting')
  const {
    prefs,
    update: handlePrefsChange,
    isLoading: loadingPrefs,
    error,
  } = useQBittorrentPrefsManager()

  if (error) {
    toast.error(getI18n().t('messages.speedLoadFailed'))
  }

  return (
    <PrefsTabLayout
      saveErrorI18nKey="messages.speedSaveFailed"
      saveSuccessI18nKey="messages.speedSaved"
    >
      {loadingPrefs && (
        <div className="text-xs text-text-tertiary flex items-center gap-2">
          <i className="i-mingcute-loading-3-line animate-spin" />
          {t('speed.loading')}
        </div>
      )}

      {/* Global rate limits */}
      <SettingSectionCard title={t('speed.global.title')}>
        <SettingField label={t('speed.global.upload')}>
          <div className="flex items-center gap-2">
            <Input
              className="w-28"
              id="up-limit"
              min={0}
              type="number"
              value={prefs.up_limit ?? 0}
              onChange={(e) =>
                handlePrefsChange({
                  up_limit: Number.parseInt(e.target.value) || 0,
                })
              }
            />
            <span className="text-xs text-text-tertiary">
              {t('speed.global.kibpsUnlimited')}
            </span>
          </div>
        </SettingField>
        <SettingField label={t('speed.global.download')}>
          <div className="flex items-center gap-2">
            <Input
              className="w-28"
              id="dl-limit"
              min={0}
              type="number"
              value={prefs.dl_limit ?? 0}
              onChange={(e) =>
                handlePrefsChange({
                  dl_limit: Number.parseInt(e.target.value) || 0,
                })
              }
            />
            <span className="text-xs text-text-tertiary">
              {t('speed.global.kibpsUnlimited')}
            </span>
          </div>
        </SettingField>
      </SettingSectionCard>

      {/* Alternative rate limits */}
      <AlternativeRateLimitsSection
        prefs={prefs}
        onChange={handlePrefsChange}
      />
      {/* Alternative rate limits scheduler */}
      <AlternativeRateLimitSchedulerSection
        prefs={prefs}
        onChange={handlePrefsChange}
      />
      {/* Rate limit options */}
      <RateLimitOptionsSection prefs={prefs} onChange={handlePrefsChange} />
    </PrefsTabLayout>
  )
}

// --- Extracted sections ---

interface SectionProps {
  onChange: (updates: Partial<Preferences>) => void
  prefs: Partial<Preferences>
}

const AlternativeRateLimitsSection = ({ prefs, onChange }: SectionProps) => {
  const { t } = useTranslation('setting')
  const altEnabled =
    (prefs.alt_dl_limit ?? 0) > 0 || (prefs.alt_up_limit ?? 0) > 0
  return (
    <SettingSectionCard enabled={altEnabled} title={t('speed.alt.title')}>
      <SettingField label={t('speed.alt.upload')}>
        <div className="flex items-center gap-2">
          <Input
            className="w-28"
            min={0}
            type="number"
            value={prefs.alt_up_limit ?? 0}
            onChange={(e) =>
              onChange({ alt_up_limit: Number.parseInt(e.target.value) || 0 })
            }
          />
          <span className="text-xs text-text-tertiary">KiB/s</span>
        </div>
      </SettingField>
      <SettingField label={t('speed.alt.download')}>
        <div className="flex items-center gap-2">
          <Input
            className="w-28"
            min={0}
            type="number"
            value={prefs.alt_dl_limit ?? 0}
            onChange={(e) =>
              onChange({ alt_dl_limit: Number.parseInt(e.target.value) || 0 })
            }
          />
          <span className="text-xs text-text-tertiary">KiB/s</span>
        </div>
      </SettingField>
    </SettingSectionCard>
  )
}

const AlternativeRateLimitSchedulerSection = ({
  prefs,
  onChange,
}: SectionProps) => {
  const { t } = useTranslation('setting')
  const schedulerEnabled = Boolean(prefs.scheduler_enabled)
  const clamp = (value: number, min: number, max: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min
  return (
    <SettingSectionCard
      enabled={schedulerEnabled}
      title={t('speed.scheduler.title')}
    >
      <SettingSwitchField
        checked={schedulerEnabled}
        label={t('speed.scheduler.enable')}
        onCheckedChange={(enable) => onChange({ scheduler_enabled: enable })}
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm">{t('speed.scheduler.from')}</span>
          <Input
            className="w-14 text-center"
            max={23}
            min={0}
            type="number"
            value={prefs.schedule_from_hour ?? 0}
            onChange={(e) =>
              onChange({
                schedule_from_hour: clamp(
                  Number.parseInt(e.target.value) || 0,
                  0,
                  23,
                ),
              })
            }
          />
          <span>:</span>
          <Input
            className="w-14 text-center"
            max={59}
            min={0}
            type="number"
            value={prefs.schedule_from_min ?? 0}
            onChange={(e) =>
              onChange({
                schedule_from_min: clamp(
                  Number.parseInt(e.target.value) || 0,
                  0,
                  59,
                ),
              })
            }
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm">{t('speed.scheduler.to')}</span>
          <Input
            className="w-14 text-center"
            max={23}
            min={0}
            type="number"
            value={prefs.schedule_to_hour ?? 0}
            onChange={(e) =>
              onChange({
                schedule_to_hour: clamp(
                  Number.parseInt(e.target.value) || 0,
                  0,
                  23,
                ),
              })
            }
          />
          <span>:</span>
          <Input
            className="w-14 text-center"
            max={59}
            min={0}
            type="number"
            value={prefs.schedule_to_min ?? 0}
            onChange={(e) =>
              onChange({
                schedule_to_min: clamp(
                  Number.parseInt(e.target.value) || 0,
                  0,
                  59,
                ),
              })
            }
          />
        </div>

        <SettingSelectField
          id="scheduler-days"
          label={t('speed.scheduler.dayLabel')}
          value={String(prefs.scheduler_days ?? 0)}
          options={[
            { value: '0', label: t('speed.schedulerDay.every') },
            { value: '1', label: t('speed.schedulerDay.weekdays') },
            { value: '2', label: t('speed.schedulerDay.weekends') },
            { value: '3', label: t('speed.schedulerDay.mon') },
            { value: '4', label: t('speed.schedulerDay.tue') },
            { value: '5', label: t('speed.schedulerDay.wed') },
            { value: '6', label: t('speed.schedulerDay.thu') },
            { value: '7', label: t('speed.schedulerDay.fri') },
            { value: '8', label: t('speed.schedulerDay.sat') },
            { value: '9', label: t('speed.schedulerDay.sun') },
          ]}
          onValueChange={(v) => {
            const raw = Number.parseInt(v)
            const clamped = Math.min(
              9,
              Math.max(0, Number.isFinite(raw) ? raw : 0),
            ) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
            onChange({ scheduler_days: clamped })
          }}
        />
      </div>
    </SettingSectionCard>
  )
}

const RateLimitOptionsSection = ({ prefs, onChange }: SectionProps) => {
  const { t } = useTranslation('setting')
  return (
    <SettingSectionCard title={t('speed.options.title')}>
      <div className="flex flex-col gap-2">
        <SettingSwitchField
          checked={Boolean(prefs.limit_utp_rate)}
          id="limit-utp-rate"
          label={t('speed.options.utp')}
          onCheckedChange={(checked) => onChange({ limit_utp_rate: checked })}
        />

        <SettingSwitchField
          checked={Boolean(prefs.limit_tcp_overhead)}
          id="limit-tcp-overhead"
          label={t('speed.options.overhead')}
          onCheckedChange={(checked) =>
            onChange({ limit_tcp_overhead: checked })
          }
        />

        <SettingSwitchField
          checked={Boolean(prefs.limit_lan_peers)}
          id="limit-lan-peers"
          label={t('speed.options.lan')}
          onCheckedChange={(checked) => onChange({ limit_lan_peers: checked })}
        />
      </div>
    </SettingSectionCard>
  )
}
