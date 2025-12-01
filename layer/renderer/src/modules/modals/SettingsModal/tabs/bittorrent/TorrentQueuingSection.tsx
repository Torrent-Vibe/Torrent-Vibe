import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { Input } from '~/components/ui/input'

import {
  SettingField,
  SettingSectionCard,
  SettingSwitchField,
} from '../components'

interface TorrentQueuingSectionProps {
  prefs: Partial<Preferences>
  onPrefsChange: (updates: Partial<Preferences>) => void
}

export const TorrentQueuingSection = ({
  prefs,
  onPrefsChange,
}: TorrentQueuingSectionProps) => {
  const { t } = useTranslation('setting')
  const queuingEnabled = prefs.queueing_enabled ?? true
  const excludeSlowTorrents = prefs.dont_count_slow_torrents ?? false

  return (
    <SettingSectionCard
      title={t('bittorrent.queueing.title')}
      enabled={queuingEnabled}
      onToggleEnabled={(checked) =>
        onPrefsChange({ queueing_enabled: Boolean(checked) })
      }
    >
      <SettingField label={t('bittorrent.queueing.maxActiveDownloads')}>
        <Input
          id="max-active-downloads"
          type="number"
          value={prefs.max_active_downloads ?? 8}
          onChange={(e) =>
            onPrefsChange({
              max_active_downloads: Number.parseInt(e.target.value) || 8,
            })
          }
          min={1}
          className="w-20"
        />
      </SettingField>
      <SettingField label={t('bittorrent.queueing.maxActiveUploads')}>
        <Input
          id="max-active-uploads"
          type="number"
          value={prefs.max_active_uploads ?? 3}
          onChange={(e) =>
            onPrefsChange({
              max_active_uploads: Number.parseInt(e.target.value) || 3,
            })
          }
          min={1}
          className="w-20"
        />
      </SettingField>
      <SettingField label={t('bittorrent.queueing.maxActiveTorrents')}>
        <Input
          id="max-active-torrents"
          type="number"
          value={prefs.max_active_torrents ?? 8}
          onChange={(e) =>
            onPrefsChange({
              max_active_torrents: Number.parseInt(e.target.value) || 8,
            })
          }
          min={1}
          className="w-20"
        />
      </SettingField>
      <SettingSwitchField
        id="exclude-slow-torrents"
        label={t('bittorrent.queueing.excludeSlowTorrents')}
        description={t('bittorrent.queueing.excludeSlowTorrentsDescription')}
        checked={excludeSlowTorrents}
        onCheckedChange={(checked) =>
          onPrefsChange({ dont_count_slow_torrents: Boolean(checked) })
        }
      />
      <SettingSectionCard
        title={t('bittorrent.queueing.slowThresholds')}
        enabled={excludeSlowTorrents}
        onToggleEnabled={(checked) =>
          onPrefsChange({ dont_count_slow_torrents: Boolean(checked) })
        }
      >
        <SettingField label={t('bittorrent.queueing.downloadRateLimit')}>
          <div className="flex items-center gap-2">
            <Input
              id="download-rate-limit"
              type="number"
              value={prefs.slow_torrent_dl_rate_threshold ?? 2}
              onChange={(e) =>
                onPrefsChange({
                  slow_torrent_dl_rate_threshold:
                    Number.parseInt(e.target.value) || 2,
                })
              }
              min={0}
              className="w-20"
            />
            <span className="text-xs text-text-tertiary">KiB/s</span>
          </div>
        </SettingField>
        <SettingField label={t('bittorrent.queueing.uploadRateLimit')}>
          <div className="flex items-center gap-2">
            <Input
              id="upload-rate-limit"
              type="number"
              value={prefs.slow_torrent_ul_rate_threshold ?? 2}
              onChange={(e) =>
                onPrefsChange({
                  slow_torrent_ul_rate_threshold:
                    Number.parseInt(e.target.value) || 2,
                })
              }
              min={0}
              className="w-20"
            />
            <span className="text-xs text-text-tertiary">KiB/s</span>
          </div>
        </SettingField>
        <SettingField label={t('bittorrent.queueing.torrentInactivityTimer')}>
          <div className="flex items-center gap-2">
            <Input
              id="torrent-inactivity-timer"
              type="number"
              value={prefs.slow_torrent_inactive_timer ?? 60}
              onChange={(e) =>
                onPrefsChange({
                  slow_torrent_inactive_timer:
                    Number.parseInt(e.target.value) || 60,
                })
              }
              min={1}
              className="w-20"
            />
            <span className="text-xs text-text-tertiary">seconds</span>
          </div>
        </SettingField>
      </SettingSectionCard>
    </SettingSectionCard>
  )
}
