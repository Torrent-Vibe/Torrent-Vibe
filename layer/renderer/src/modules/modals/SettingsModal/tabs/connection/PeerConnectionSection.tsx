import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import {
  SettingSectionCard,
  SettingSelectField,
  SettingSwitchField,
} from '../components'

interface PeerConnectionSectionProps {
  prefs: Partial<Preferences>
  onPrefsChange: (updates: Partial<Preferences>) => void
}

export const PeerConnectionSection = ({
  prefs,
  onPrefsChange,
}: PeerConnectionSectionProps) => {
  const { t } = useTranslation('setting')
  return (
    <SettingSectionCard title={t('connection.peer.title')}>
      <SettingSelectField
        label={t('connection.peer.encryption')}
        value={
          prefs.encryption === 0
            ? 'disabled'
            : prefs.encryption === 1
              ? 'enabled'
              : 'forced'
        }
        onValueChange={(value) => {
          const encryptionValue =
            value === 'disabled' ? 0 : value === 'enabled' ? 1 : 2
          onPrefsChange({ encryption: encryptionValue })
        }}
        options={[
          { value: 'disabled', label: t('connection.peer.encryptionDisabled') },
          { value: 'enabled', label: t('connection.peer.encryptionEnabled') },
          { value: 'forced', label: t('connection.peer.encryptionForced') },
        ]}
      />
      <div className="text-xs text-text-secondary ml-6">
        {t('connection.peer.encryptionDescription')}
      </div>

      <SettingSwitchField
        id="anonymous_mode"
        label={t('connection.peer.anonymousMode')}
        checked={Boolean(prefs.anonymous_mode)}
        onCheckedChange={(checked) =>
          onPrefsChange({ anonymous_mode: Boolean(checked) })
        }
      />
      <div className="text-xs text-text-secondary ml-6">
        {t('connection.peer.anonymousDescription')}
      </div>
    </SettingSectionCard>
  )
}
