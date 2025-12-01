import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import {
  SettingInputField,
  SettingSectionCard,
  SettingSwitchField,
} from '../components'

interface EmailNotificationSectionProps {
  prefs: Partial<Preferences>
  onPrefsChange: (updates: Partial<Preferences>) => void
}

export const EmailNotificationSection = ({
  prefs,
  onPrefsChange,
}: EmailNotificationSectionProps) => {
  const { t } = useTranslation('setting')
  return (
    <SettingSectionCard
      title={t('downloads.email.title')}
      enabled={Boolean(prefs.mail_notification_enabled)}
      onToggleEnabled={(v) =>
        onPrefsChange({ mail_notification_enabled: Boolean(v) })
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SettingInputField
          label={t('downloads.email.from')}
          value={prefs.mail_notification_sender ?? ''}
          onChange={(v) => onPrefsChange({ mail_notification_sender: v })}
          placeholder="qBittorrent_notification@example.com"
        />
        <SettingInputField
          label={t('downloads.email.to')}
          value={prefs.mail_notification_email ?? ''}
          onChange={(v) => onPrefsChange({ mail_notification_email: v })}
          placeholder="user@example.com"
        />
        <SettingInputField
          label={t('downloads.email.smtp')}
          value={prefs.mail_notification_smtp ?? ''}
          onChange={(v) => onPrefsChange({ mail_notification_smtp: v })}
          placeholder="smtp.changeme.com"
        />
        <SettingSwitchField
          id="mail_notification_ssl_enabled"
          label={t('downloads.email.ssl')}
          checked={Boolean(prefs.mail_notification_ssl_enabled)}
          onCheckedChange={(v) =>
            onPrefsChange({ mail_notification_ssl_enabled: Boolean(v) })
          }
        />
      </div>

      <SettingSectionCard
        title={t('downloads.email.auth')}
        enabled={Boolean(prefs.mail_notification_auth_enabled)}
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
