import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import {
  SettingSectionCard,
  SettingSelectField,
  SettingSwitchField,
} from '../components'

interface PrivacySectionProps {
  onPrefsChange: (updates: Partial<Preferences>) => void
  prefs: Partial<Preferences>
}

export const PrivacySection = ({
  prefs,
  onPrefsChange,
}: PrivacySectionProps) => {
  const { t } = useTranslation('setting')
  return (
    <SettingSectionCard title={t('bittorrent.privacy.title')}>
      <SettingSwitchField
        checked={prefs.dht ?? true}
        id="enable-dht"
        label={t('bittorrent.privacy.dht')}
        onCheckedChange={(checked) => onPrefsChange({ dht: Boolean(checked) })}
      />
      <SettingSwitchField
        checked={prefs.pex ?? true}
        id="enable-pex"
        label={t('bittorrent.privacy.pex')}
        onCheckedChange={(checked) => onPrefsChange({ pex: Boolean(checked) })}
      />
      <SettingSwitchField
        checked={prefs.lsd ?? true}
        id="enable-lsd"
        label={t('bittorrent.privacy.lsd')}
        onCheckedChange={(checked) => onPrefsChange({ lsd: Boolean(checked) })}
      />
      <SettingSelectField
        label={t('bittorrent.privacy.encryption')}
        value={String(prefs.encryption ?? 0)}
        options={[
          { value: '0', label: t('bittorrent.privacy.encryptionPrefer') },
          { value: '1', label: t('bittorrent.privacy.encryptionRequire') },
          { value: '2', label: t('bittorrent.privacy.encryptionDisable') },
        ]}
        onValueChange={(value) =>
          onPrefsChange({ encryption: Number.parseInt(value) as 0 | 1 | 2 })
        }
      />
      <SettingSwitchField
        checked={prefs.anonymous_mode ?? false}
        id="anonymous-mode"
        label={t('bittorrent.privacy.anonymousMode')}
        onCheckedChange={(checked) =>
          onPrefsChange({ anonymous_mode: Boolean(checked) })
        }
      />
    </SettingSectionCard>
  )
}
