import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { Input } from '~/components/ui/input'

import {
  SettingField,
  SettingSectionCard,
  SettingSwitchField,
} from '../components'

interface TorrentQueuingSectionProps {
  onPrefsChange: (updates: Partial<Preferences>) => void
  prefs: Partial<Preferences>
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
      enabled={queuingEnabled}
      title={t('bittorrent.queueing.title')}
      onToggleEnabled={(checked) =>
        onPrefsChange({ queueing_enabled: Boolean(checked) })
      }
    >
      <SettingField label={t('bittorrent.queueing.maxActiveDownloads')}>
        <Input
          className="w-20"
          id="max-active-downloads"
          min={1}
          type="number"
          value={prefs.max_active_downloads ?? 8}
          onChange={(e) =>
            onPrefsChange({
              max_active_downloads: Number.parseInt(e.target.value) || 8,
            })
          }
        />
      </SettingField>
      <SettingField label={t('bittorrent.queueing.maxActiveUploads')}>
        <Input
          className="w-20"
          id="max-active-uploads"
          min={1}
          type="number"
          value={prefs.max_active_uploads ?? 3}
          onChange={(e) =>
            onPrefsChange({
              max_active_uploads: Number.parseInt(e.target.value) || 3,
            })
          }
        />
      </SettingField>
      <SettingField label={t('bittorrent.queueing.maxActiveTorrents')}>
        <Input
          className="w-20"
          id="max-active-torrents"
          min={1}
          type="number"
          value={prefs.max_active_torrents ?? 8}
          onChange={(e) =>
            onPrefsChange({
              max_active_torrents: Number.parseInt(e.target.value) || 8,
            })
          }
        />
      </SettingField>
      <SettingSwitchField
        checked={excludeSlowTorrents}
        description={t('bittorrent.queueing.excludeSlowTorrentsDescription')}
        id="exclude-slow-torrents"
        label={t('bittorrent.queueing.excludeSlowTorrents')}
        onCheckedChange={(checked) =>
          onPrefsChange({ dont_count_slow_torrents: Boolean(checked) })
        }
      />
      <SettingSectionCard
        enabled={excludeSlowTorrents}
        title={t('bittorrent.queueing.slowThresholds')}
        onToggleEnabled={(checked) =>
          onPrefsChange({ dont_count_slow_torrents: Boolean(checked) })
        }
      >
        <SettingField label={t('bittorrent.queueing.downloadRateLimit')}>
          <div className="flex items-center gap-2">
            <Input
              className="w-20"
              id="download-rate-limit"
              min={0}
              type="number"
              value={prefs.slow_torrent_dl_rate_threshold ?? 2}
              onChange={(e) =>
                onPrefsChange({
                  slow_torrent_dl_rate_threshold:
                    Number.parseInt(e.target.value) || 2,
                })
              }
            />
            <span className="text-xs text-text-tertiary">KiB/s</span>
          </div>
        </SettingField>
        <SettingField label={t('bittorrent.queueing.uploadRateLimit')}>
          <div className="flex items-center gap-2">
            <Input
              className="w-20"
              id="upload-rate-limit"
              min={0}
              type="number"
              value={prefs.slow_torrent_ul_rate_threshold ?? 2}
              onChange={(e) =>
                onPrefsChange({
                  slow_torrent_ul_rate_threshold:
                    Number.parseInt(e.target.value) || 2,
                })
              }
            />
            <span className="text-xs text-text-tertiary">KiB/s</span>
          </div>
        </SettingField>
        <SettingField label={t('bittorrent.queueing.torrentInactivityTimer')}>
          <div className="flex items-center gap-2">
            <Input
              className="w-20"
              id="torrent-inactivity-timer"
              min={1}
              type="number"
              value={prefs.slow_torrent_inactive_timer ?? 60}
              onChange={(e) =>
                onPrefsChange({
                  slow_torrent_inactive_timer:
                    Number.parseInt(e.target.value) || 60,
                })
              }
            />
            <span className="text-xs text-text-tertiary">seconds</span>
          </div>
        </SettingField>
      </SettingSectionCard>
    </SettingSectionCard>
  )
}
