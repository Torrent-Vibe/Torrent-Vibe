import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { Input } from '~/components/ui/input'

import {
  SettingSectionCard,
  SettingSelectField,
  SettingToggleField,
} from '../components'

interface SeedingLimitsSectionProps {
  prefs: Partial<Preferences>
  onPrefsChange: (updates: Partial<Preferences>) => void
}

export const SeedingLimitsSection = ({
  prefs,
  onPrefsChange,
}: SeedingLimitsSectionProps) => {
  const { t } = useTranslation('setting')
  return (
    <SettingSectionCard title={t('bittorrent.seeding.title')}>
      <SettingToggleField
        label={t('bittorrent.seeding.ratioReaches')}
        enabled={prefs.max_ratio_enabled ?? false}
        onEnabledChange={(checked) =>
          onPrefsChange({ max_ratio_enabled: Boolean(checked) })
        }
      >
        <Input
          type="number"
          step="0.1"
          value={prefs.max_ratio ?? 1}
          onChange={(e) =>
            onPrefsChange({ max_ratio: Number.parseFloat(e.target.value) || 1 })
          }
          min={0}
          className="w-20"
        />
      </SettingToggleField>

      <SettingToggleField
        label={t('bittorrent.seeding.seedingTimeReaches')}
        enabled={prefs.max_seeding_time_enabled ?? false}
        onEnabledChange={(checked) =>
          onPrefsChange({ max_seeding_time_enabled: Boolean(checked) })
        }
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={prefs.max_seeding_time ?? 1440}
            onChange={(e) =>
              onPrefsChange({
                max_seeding_time: Number.parseInt(e.target.value) || 1440,
              })
            }
            min={1}
            className="w-24"
          />
          <span className="text-xs text-text-tertiary">
            {t('bittorrent.seeding.minutes')}
          </span>
        </div>
      </SettingToggleField>

      <SettingSelectField
        label={t('bittorrent.seeding.then')}
        value={String(prefs.max_ratio_act ?? 0)}
        onValueChange={(value) => {
          const action = Number.parseInt(value)
          onPrefsChange({ max_ratio_act: action as any })
        }}
        options={[
          { value: '0', label: t('bittorrent.seeding.pauseTorrent') },
          { value: '1', label: t('bittorrent.seeding.removeTorrent') },
          { value: '3', label: t('bittorrent.seeding.enableSuperSeeding') },
        ]}
      />
    </SettingSectionCard>
  )
}
