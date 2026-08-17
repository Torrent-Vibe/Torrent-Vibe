import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import {
  SettingInputField,
  SettingSectionCard,
  SettingSwitchField,
} from '../components'

interface EmailNotificationSectionProps {
  onPrefsChange: (updates: Partial<Preferences>) => void
  prefs: Partial<Preferences>
}

export const EmailNotificationSection = ({
  prefs,
  onPrefsChange,
}: EmailNotificationSectionProps) => {
  const { t } = useTranslation('setting')
  return (
    <SettingSectionCard
      enabled={Boolean(prefs.mail_notification_enabled)}
      title={t('downloads.email.title')}
      onToggleEnabled={(v) =>
        onPrefsChange({ mail_notification_enabled: Boolean(v) })
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SettingInputField
          label={t('downloads.email.from')}
          placeholder="qBittorrent_notification@example.com"
          value={prefs.mail_notification_sender ?? ''}
          onChange={(v) => onPrefsChange({ mail_notification_sender: v })}
        />
        <SettingInputField
          label={t('downloads.email.to')}
          placeholder="user@example.com"
          value={prefs.mail_notification_email ?? ''}
          onChange={(v) => onPrefsChange({ mail_notification_email: v })}
        />
        <SettingInputField
          label={t('downloads.email.smtp')}
          placeholder="smtp.changeme.com"
          value={prefs.mail_notification_smtp ?? ''}
          onChange={(v) => onPrefsChange({ mail_notification_smtp: v })}
        />
        <SettingSwitchField
          checked={Boolean(prefs.mail_notification_ssl_enabled)}
          id="mail_notification_ssl_enabled"
          label={t('downloads.email.ssl')}
          onCheckedChange={(v) =>
            onPrefsChange({ mail_notification_ssl_enabled: Boolean(v) })
          }
        />
      </div>

      <SettingSectionCard
        enabled={Boolean(prefs.mail_notification_auth_enabled)}
        title={t('downloads.email.auth')}
        onToggleEnabled={(v) =>
          onPrefsChange({ mail_notification_auth_enabled: Boolean(v) })
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SettingInputField
            label={t('downloads.email.username')}
            value={prefs.mail_notification_username ?? ''}
            onChange={(v) => onPrefsChange({ mail_notification_username: v })}
          />
          <SettingInputField
            label={t('downloads.email.password')}
            type="password"
            value={prefs.mail_notification_password ?? ''}
            onChange={(v) => onPrefsChange({ mail_notification_password: v })}
          />
        </div>
      </SettingSectionCard>
    </SettingSectionCard>
  )
}
