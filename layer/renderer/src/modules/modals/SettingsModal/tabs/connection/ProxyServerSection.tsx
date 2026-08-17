import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

import {
  SettingField,
  SettingInputField,
  SettingSectionCard,
  SettingSwitchField,
} from '../components'

interface ProxyServerSectionProps {
  onPrefsChange: (updates: Partial<Preferences>) => void
  prefs: Partial<Preferences>
}

const PROXY_TYPES = {
  0: 'None',
  1: 'HTTP',
  2: 'SOCKS5',
  3: 'SOCKS4',
} as const

export const ProxyServerSection = ({
  prefs,
  onPrefsChange,
}: ProxyServerSectionProps) => {
  const { t } = useTranslation('setting')
  const proxyEnabled = prefs.proxy_type && prefs.proxy_type > 0

  return (
    <SettingSectionCard title={t('connection.proxy.title')}>
      <SettingField label={t('connection.proxy.type')}>
        <Select
          value={prefs.proxy_type?.toString() || '0'}
          onValueChange={(value) =>
            onPrefsChange({ proxy_type: Number.parseInt(value) })
          }
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PROXY_TYPES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingField>
      <SettingInputField
        disabled={!proxyEnabled}
        label={t('connection.proxy.host')}
        value={prefs.proxy_ip || ''}
        onChange={(v) => onPrefsChange({ proxy_ip: v })}
      />
      <SettingInputField
        disabled={!proxyEnabled}
        label={t('connection.proxy.port')}
        type="number"
        value={String(prefs.proxy_port || 8080)}
        onChange={(v) =>
          onPrefsChange({ proxy_port: Number.parseInt(v) || 8080 })
        }
      />

      <SettingSwitchField
        checked={Boolean(prefs.proxy_peer_connections)}
        disabled={!proxyEnabled}
        id="proxy_peer_connections"
        label={t('connection.proxy.peerConnections')}
        onCheckedChange={(v) =>
          onPrefsChange({ proxy_peer_connections: Boolean(v) })
        }
      />

      <SettingSectionCard
        enabled={Boolean(prefs.proxy_auth_enabled)}
        title={t('connection.proxy.auth')}
        onToggleEnabled={(v) =>
          onPrefsChange({ proxy_auth_enabled: Boolean(v) })
        }
      >
        <SettingInputField
          disabled={!proxyEnabled}
          label={t('connection.proxy.username')}
          value={prefs.proxy_username || ''}
          onChange={(v) => onPrefsChange({ proxy_username: v })}
        />
        <SettingInputField
          disabled={!proxyEnabled}
          label={t('connection.proxy.password')}
          type="password"
          value={prefs.proxy_password || ''}
          onChange={(v) => onPrefsChange({ proxy_password: v })}
        />
        <div className="text-xs text-text-secondary">
          {t('connection.proxy.passwordTip')}
        </div>
      </SettingSectionCard>

      <SettingSectionCard title={t('connection.proxy.bittorrent')}>
        <SettingSwitchField
          disabled
          checked={false}
          id="proxy_rss"
          label={t('connection.proxy.rss')}
          onCheckedChange={() => {}}
        />
        <SettingSwitchField
          disabled
          checked={false}
          id="proxy_general"
          label={t('connection.proxy.general')}
          onCheckedChange={() => {}}
        />
      </SettingSectionCard>
    </SettingSectionCard>
  )
}
