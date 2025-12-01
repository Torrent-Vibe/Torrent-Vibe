import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { Input } from '~/components/ui/input'
import { SelectItem } from '~/components/ui/select'

import {
  SettingField,
  SettingInputField,
  SettingSectionCard,
  SettingSelectField,
  SettingSwitchField,
} from '../components'

interface QBittorrentAdvancedSectionProps {
  prefs: Partial<Preferences>
  onPrefsChange: (updates: Partial<Preferences>) => void
}

export const QBittorrentAdvancedSection = ({
  prefs,
  onPrefsChange,
}: QBittorrentAdvancedSectionProps) => {
  const { t } = useTranslation('setting')
  return (
    <SettingSectionCard title="qBittorrent">
      <SettingSwitchField
        id="recheck-completed-torrents"
        label={t('advanced.qbittorrent.features.recheckCompletedTorrents')}
        checked={prefs.recheck_completed_torrents ?? false}
        onCheckedChange={(checked) =>
          onPrefsChange({ recheck_completed_torrents: Boolean(checked) })
        }
      />
      <SettingField label={t('advanced.qbittorrent.network.checkingMemoryUse')}>
        <div className="flex items-center gap-2">
          <Input
            id="checking-memory-use"
            type="number"
            value={prefs.checking_memory_use ?? 32}
            onChange={(e) =>
              onPrefsChange({
                checking_memory_use: Number.parseInt(e.target.value) || 32,
              })
            }
            className="w-24"
          />
          <span className="text-sm text-text-tertiary">
            {t('advanced.qbittorrent.network.memoryUnit')}
          </span>
        </div>
      </SettingField>
      <SettingSelectField
        label={t('advanced.qbittorrent.network.networkInterface')}
        value={prefs.current_network_interface ?? ''}
        onValueChange={(value) =>
          onPrefsChange({
            current_network_interface: value === '__clear__' ? '' : value,
          })
        }
        renderItems={() => (
          <SelectItem value="__clear__">
            {t('advanced.qbittorrent.network.interface.any')}
          </SelectItem>
        )}
      />
      <SettingInputField
        label={t('advanced.qbittorrent.network.interface.label')}
        value={prefs.current_interface_address ?? ''}
        onChange={(v) => onPrefsChange({ current_interface_address: v })}
        placeholder={t('advanced.qbittorrent.network.address.placeholder')}
      />
      <SettingField
        label={t('advanced.qbittorrent.network.resumeDataInterval.label')}
      >
        <div className="flex items-center gap-2">
          <Input
            id="save-resume-data-interval"
            type="number"
            value={prefs.save_resume_data_interval ?? 60}
            onChange={(e) =>
              onPrefsChange({
                save_resume_data_interval:
                  Number.parseInt(e.target.value) || 60,
              })
            }
            className="w-24"
          />
          <span className="text-sm text-text-tertiary">
            {t('advanced.qbittorrent.network.resumeDataInterval.unit')}
          </span>
        </div>
      </SettingField>
      <SettingInputField
        label={t('advanced.qbittorrent.network.exportDir.label')}
        value={prefs.export_dir ?? ''}
        onChange={(v) => onPrefsChange({ export_dir: v })}
        placeholder={t('advanced.qbittorrent.network.exportDir.placeholder')}
      />
      <SettingSwitchField
        id="resolve-peer-countries"
        label={t('advanced.qbittorrent.features.resolvePeerCountries')}
        checked={prefs.resolve_peer_countries ?? false}
        onCheckedChange={(checked) =>
          onPrefsChange({ resolve_peer_countries: Boolean(checked) })
        }
      />
      <SettingSwitchField
        id="announce-to-all-trackers"
        label={t('advanced.qbittorrent.features.announceToAllTrackers')}
        checked={prefs.announce_to_all_trackers ?? false}
        onCheckedChange={(checked) =>
          onPrefsChange({ announce_to_all_trackers: Boolean(checked) })
        }
      />
      <SettingSwitchField
        id="enable-embedded-tracker"
        label={t('advanced.qbittorrent.features.enableEmbeddedTracker')}
        checked={prefs.enable_embedded_tracker ?? false}
        onCheckedChange={(checked) =>
          onPrefsChange({ enable_embedded_tracker: Boolean(checked) })
        }
      />
      <SettingInputField
        label={t('advanced.qbittorrent.features.embeddedTrackerPort')}
        type="number"
        value={String(prefs.embedded_tracker_port ?? 9000)}
        onChange={(v) =>
          onPrefsChange({ embedded_tracker_port: Number.parseInt(v) || 9000 })
        }
      />
      <SettingSwitchField
        id="enable-multi-connections"
        label={t('advanced.qbittorrent.features.allowMultipleConnections')}
        checked={prefs.enable_multi_connections_from_same_ip ?? false}
        onCheckedChange={(checked) =>
          onPrefsChange({
            enable_multi_connections_from_same_ip: Boolean(checked),
          })
        }
      />
    </SettingSectionCard>
  )
}
