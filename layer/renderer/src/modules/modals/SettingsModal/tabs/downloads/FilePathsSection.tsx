import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { SettingInputField, SettingSectionCard } from '../components'

interface FilePathsSectionProps {
  prefs: Partial<Preferences>
  onPrefsChange: (updates: Partial<Preferences>) => void
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
        value={prefs.save_path ?? ''}
        onChange={(v) => onPrefsChange({ save_path: v })}
        placeholder="/downloads"
      />

      <SettingSectionCard
        title={t('downloads.paths.keepIncomplete')}
        enabled={Boolean(prefs.temp_path_enabled)}
        onToggleEnabled={(v) =>
          onPrefsChange({ temp_path_enabled: Boolean(v) })
        }
      >
        <SettingInputField
          label={'Path'}
          value={prefs.temp_path ?? ''}
          onChange={(v) => onPrefsChange({ temp_path: v })}
          placeholder="/downloads-temp"
        />
      </SettingSectionCard>

      <SettingInputField
        label={t('downloads.paths.copyTorrentFiles')}
        value={prefs.export_dir ?? ''}
        onChange={(v) => onPrefsChange({ export_dir: v })}
        placeholder="/downloads/.torrents"
      />

      <SettingSectionCard
        title={t('downloads.paths.copyFinishedFiles')}
        enabled={Boolean(prefs.export_dir_fin)}
        onToggleEnabled={(v) =>
          onPrefsChange({ export_dir_fin: v ? '/downloads/torrents' : '' })
        }
      >
        <SettingInputField
          label={'Path'}
          value={prefs.export_dir_fin ?? ''}
          onChange={(v) => onPrefsChange({ export_dir_fin: v })}
          placeholder="/downloads/torrents"
        />
      </SettingSectionCard>
    </SettingSectionCard>
  )
}
