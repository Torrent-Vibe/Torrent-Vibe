import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { SettingInputField, SettingSectionCard } from '../components'

interface FilePathsSectionProps {
  onPrefsChange: (updates: Partial<Preferences>) => void
  prefs: Partial<Preferences>
}

export const FilePathsSection = ({
  prefs,
  onPrefsChange,
}: FilePathsSectionProps) => {
  const { t } = useTranslation('setting')
  return (
    <SettingSectionCard title={t('downloads.paths.title')}>
      <SettingInputField
        label={t('downloads.paths.defaultSavePath')}
        placeholder="/downloads"
        value={prefs.save_path ?? ''}
        onChange={(v) => onPrefsChange({ save_path: v })}
      />

      <SettingSectionCard
        enabled={Boolean(prefs.temp_path_enabled)}
        title={t('downloads.paths.keepIncomplete')}
        onToggleEnabled={(v) =>
          onPrefsChange({ temp_path_enabled: Boolean(v) })
        }
      >
        <SettingInputField
          label={'Path'}
          placeholder="/downloads-temp"
          value={prefs.temp_path ?? ''}
          onChange={(v) => onPrefsChange({ temp_path: v })}
        />
      </SettingSectionCard>

      <SettingInputField
        label={t('downloads.paths.copyTorrentFiles')}
        placeholder="/downloads/.torrents"
        value={prefs.export_dir ?? ''}
        onChange={(v) => onPrefsChange({ export_dir: v })}
      />

      <SettingSectionCard
        enabled={Boolean(prefs.export_dir_fin)}
        title={t('downloads.paths.copyFinishedFiles')}
        onToggleEnabled={(v) =>
          onPrefsChange({ export_dir_fin: v ? '/downloads/torrents' : '' })
        }
      >
        <SettingInputField
          label={'Path'}
          placeholder="/downloads/torrents"
          value={prefs.export_dir_fin ?? ''}
          onChange={(v) => onPrefsChange({ export_dir_fin: v })}
        />
      </SettingSectionCard>
    </SettingSectionCard>
  )
}
