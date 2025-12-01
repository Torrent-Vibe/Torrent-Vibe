import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import {
  SettingSectionCard,
  SettingSelectField,
  SettingSwitchField,
} from '../components'

interface PrivacySectionProps {
  prefs: Partial<Preferences>
  onPrefsChange: (updates: Partial<Preferences>) => void
}

export const PrivacySection = ({
  prefs,
  onPrefsChange,
}: PrivacySectionProps) => {
  const { t } = useTranslation('setting')
  return (
    <SettingSectionCard title={t('bittorrent.privacy.title')}>
      <SettingSwitchField
        id="enable-dht"
        label={t('bittorrent.privacy.dht')}
        checked={prefs.dht ?? true}
        onCheckedChange={(checked) => onPrefsChange({ dht: Boolean(checked) })}
      />
      <SettingSwitchField
        id="enable-pex"
        label={t('bittorrent.privacy.pex')}
        checked={prefs.pex ?? true}
        onCheckedChange={(checked) => onPrefsChange({ pex: Boolean(checked) })}
      />
      <SettingSwitchField
        id="enable-lsd"
        label={t('bittorrent.privacy.lsd')}
        checked={prefs.lsd ?? true}
        onCheckedChange={(checked) => onPrefsChange({ lsd: Boolean(checked) })}
      />
      <SettingSelectField
        label={t('bittorrent.privacy.encryption')}
        value={String(prefs.encryption ?? 0)}
        onValueChange={(value) =>
          onPrefsChange({ encryption: Number.parseInt(value) as 0 | 1 | 2 })
        }
        options={[
          { value: '0', label: t('bittorrent.privacy.encryptionPrefer') },
          { value: '1', label: t('bittorrent.privacy.encryptionRequire') },
          { value: '2', label: t('bittorrent.privacy.encryptionDisable') },
        ]}
      />
      <SettingSwitchField
        id="anonymous-mode"
        label={t('bittorrent.privacy.anonymousMode')}
        checked={prefs.anonymous_mode ?? false}
        onCheckedChange={(checked) =>
          onPrefsChange({ anonymous_mode: Boolean(checked) })
        }
      />
    </SettingSectionCard>
  )
}
