import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import {
  SettingInputField,
  SettingSectionCard,
  SettingSwitchField,
  SettingTextareaField,
} from '../components'

interface IPFilteringSectionProps {
  prefs: Partial<Preferences>
  onPrefsChange: (updates: Partial<Preferences>) => void
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
        label={t('connection.ipFiltering.filterPathEnabled')}
        checked={ipFilterEnabled}
        onCheckedChange={(v) => handleChange({ ip_filter_enabled: Boolean(v) })}
      />
      <SettingInputField
        label={t('connection.ipFiltering.filterPath')}
        value={ipFilterPath}
        onChange={(v) => handleChange({ ip_filter_path: v })}
      />
      <SettingSwitchField
        id="ip_filter_trackers"
        label={t('connection.ipFiltering.applyToTrackers')}
        checked={ipFilterTrackers}
        onCheckedChange={(v) =>
          handleChange({ ip_filter_trackers: Boolean(v) })
        }
      />
      <SettingTextareaField
        label={t('connection.ipFiltering.bannedIPs')}
        value={bannedIPs}
        onChange={(v) => handleChange({ banned_IPs: v })}
        placeholder={t('connection.ipFiltering.placeholder') as any}
        rows={6}
      />
    </SettingSectionCard>
  )
}
