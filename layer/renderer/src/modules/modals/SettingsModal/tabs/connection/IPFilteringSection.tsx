import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import {
  SettingInputField,
  SettingSectionCard,
  SettingSwitchField,
  SettingTextareaField,
} from '../components'

interface IPFilteringSectionProps {
  onPrefsChange: (updates: Partial<Preferences>) => void
  prefs: Partial<Preferences>
}

export const IPFilteringSection = ({
  prefs,
  onPrefsChange,
}: IPFilteringSectionProps) => {
  const { t } = useTranslation('setting')
  const ipFilterEnabled = Boolean((prefs as any).ip_filter_enabled)
  const ipFilterPath = ((prefs as any).ip_filter_path ?? '') as string
  const ipFilterTrackers = Boolean((prefs as any).ip_filter_trackers)
  const bannedIPs = ((prefs as any).banned_IPs ?? '') as string

  const handleChange = (updates: Record<string, unknown>) => {
    ;(onPrefsChange as any)(updates)
  }

  return (
    <SettingSectionCard title={t('connection.ipFiltering.title')}>
      <SettingSwitchField
        checked={ipFilterEnabled}
        label={t('connection.ipFiltering.filterPathEnabled')}
        onCheckedChange={(v) => handleChange({ ip_filter_enabled: Boolean(v) })}
      />
      <SettingInputField
        label={t('connection.ipFiltering.filterPath')}
        value={ipFilterPath}
        onChange={(v) => handleChange({ ip_filter_path: v })}
      />
      <SettingSwitchField
        checked={ipFilterTrackers}
        id="ip_filter_trackers"
        label={t('connection.ipFiltering.applyToTrackers')}
        onCheckedChange={(v) =>
          handleChange({ ip_filter_trackers: Boolean(v) })
        }
      />
      <SettingTextareaField
        label={t('connection.ipFiltering.bannedIPs')}
        placeholder={t('connection.ipFiltering.placeholder') as any}
        rows={6}
        value={bannedIPs}
        onChange={(v) => handleChange({ banned_IPs: v })}
      />
    </SettingSectionCard>
  )
}
