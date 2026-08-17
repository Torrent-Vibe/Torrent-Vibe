import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { Input } from '~/components/ui/input'

import { SettingSectionCard, SettingToggleField } from '../components'

interface ConnectionLimitsSectionProps {
  onPrefsChange: (updates: Partial<Preferences>) => void
  prefs: Partial<Preferences>
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
        enabled={maxConnecEnabled}
        label={t('connection.limits.globalConnections')}
        onEnabledChange={(v) =>
          onPrefsChange({
            max_connec: v ? (prefs.max_connec ?? 500) || 500 : -1,
          })
        }
      >
        <Input
          className="w-20"
          min={0}
          type="number"
          value={prefs.max_connec ?? 500}
          onChange={(e) =>
            onPrefsChange({ max_connec: Number.parseInt(e.target.value) || 0 })
          }
        />
      </SettingToggleField>

      <SettingToggleField
        enabled={maxConnecPerTorrentEnabled}
        label={t('connection.limits.connectionsPerTorrent')}
        onEnabledChange={(v) =>
          onPrefsChange({
            max_connec_per_torrent: v
              ? (prefs.max_connec_per_torrent ?? 100) || 100
              : -1,
          })
        }
      >
        <Input
          className="w-20"
          min={0}
          type="number"
          value={prefs.max_connec_per_torrent ?? 100}
          onChange={(e) =>
            onPrefsChange({
              max_connec_per_torrent: Number.parseInt(e.target.value) || 0,
            })
          }
        />
      </SettingToggleField>

      <SettingToggleField
        enabled={maxUploadsEnabled}
        label={t('connection.limits.globalUploads')}
        onEnabledChange={(v) =>
          onPrefsChange({ max_uploads: v ? (prefs.max_uploads ?? 8) || 8 : -1 })
        }
      >
        <Input
          className="w-20"
          min={0}
          type="number"
          value={prefs.max_uploads ?? 8}
          onChange={(e) =>
            onPrefsChange({ max_uploads: Number.parseInt(e.target.value) || 0 })
          }
        />
      </SettingToggleField>

      <SettingToggleField
        enabled={maxUploadsPerTorrentEnabled}
        label={t('connection.limits.uploadsPerTorrent')}
        onEnabledChange={(v) =>
          onPrefsChange({
            max_uploads_per_torrent: v
              ? (prefs.max_uploads_per_torrent ?? 4) || 4
              : -1,
          })
        }
      >
        <Input
          className="w-20"
          min={0}
          type="number"
          value={prefs.max_uploads_per_torrent ?? 4}
          onChange={(e) =>
            onPrefsChange({
              max_uploads_per_torrent: Number.parseInt(e.target.value) || 0,
            })
          }
        />
      </SettingToggleField>
    </SettingSectionCard>
  )
}
