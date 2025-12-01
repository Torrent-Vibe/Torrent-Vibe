import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { Input } from '~/components/ui/input'

import { SettingSectionCard, SettingToggleField } from '../components'

interface ConnectionLimitsSectionProps {
  prefs: Partial<Preferences>
  onPrefsChange: (updates: Partial<Preferences>) => void
}

export const ConnectionLimitsSection = ({
  prefs,
  onPrefsChange,
}: ConnectionLimitsSectionProps) => {
  const { t } = useTranslation('setting')
  const maxConnecEnabled = (prefs.max_connec ?? 0) !== -1
  const maxConnecPerTorrentEnabled = (prefs.max_connec_per_torrent ?? 0) !== -1
  const maxUploadsEnabled = (prefs.max_uploads ?? 0) !== -1
  const maxUploadsPerTorrentEnabled =
    (prefs.max_uploads_per_torrent ?? 0) !== -1
  return (
    <SettingSectionCard title={t('connection.limits.title')}>
      <SettingToggleField
        label={t('connection.limits.globalConnections')}
        enabled={maxConnecEnabled}
        onEnabledChange={(v) =>
          onPrefsChange({
            max_connec: v ? (prefs.max_connec ?? 500) || 500 : -1,
          })
        }
      >
        <Input
          type="number"
          value={prefs.max_connec ?? 500}
          onChange={(e) =>
            onPrefsChange({ max_connec: Number.parseInt(e.target.value) || 0 })
          }
          min={0}
          className="w-20"
        />
      </SettingToggleField>

      <SettingToggleField
        label={t('connection.limits.connectionsPerTorrent')}
        enabled={maxConnecPerTorrentEnabled}
        onEnabledChange={(v) =>
          onPrefsChange({
            max_connec_per_torrent: v
              ? (prefs.max_connec_per_torrent ?? 100) || 100
              : -1,
          })
        }
      >
        <Input
          type="number"
          value={prefs.max_connec_per_torrent ?? 100}
          onChange={(e) =>
            onPrefsChange({
              max_connec_per_torrent: Number.parseInt(e.target.value) || 0,
            })
          }
          min={0}
          className="w-20"
        />
      </SettingToggleField>

      <SettingToggleField
        label={t('connection.limits.globalUploads')}
        enabled={maxUploadsEnabled}
        onEnabledChange={(v) =>
          onPrefsChange({ max_uploads: v ? (prefs.max_uploads ?? 8) || 8 : -1 })
        }
      >
        <Input
          type="number"
          value={prefs.max_uploads ?? 8}
          onChange={(e) =>
            onPrefsChange({ max_uploads: Number.parseInt(e.target.value) || 0 })
          }
          min={0}
          className="w-20"
        />
      </SettingToggleField>

      <SettingToggleField
        label={t('connection.limits.uploadsPerTorrent')}
        enabled={maxUploadsPerTorrentEnabled}
        onEnabledChange={(v) =>
          onPrefsChange({
            max_uploads_per_torrent: v
              ? (prefs.max_uploads_per_torrent ?? 4) || 4
              : -1,
          })
        }
      >
        <Input
          type="number"
          value={prefs.max_uploads_per_torrent ?? 4}
          onChange={(e) =>
            onPrefsChange({
              max_uploads_per_torrent: Number.parseInt(e.target.value) || 0,
            })
          }
          min={0}
          className="w-20"
        />
      </SettingToggleField>
    </SettingSectionCard>
  )
}
