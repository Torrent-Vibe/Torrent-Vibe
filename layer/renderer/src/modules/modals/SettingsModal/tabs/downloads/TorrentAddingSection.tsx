import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { SettingSectionCard, SettingSwitchField } from '../components'

interface TorrentAddingSectionProps {
  onPrefsChange: (updates: Partial<Preferences>) => void
  prefs: Partial<Preferences>
}

export const TorrentAddingSection = ({
  prefs,
  onPrefsChange,
}: TorrentAddingSectionProps) => {
  const { t } = useTranslation('setting')
  const startAutomatically = !(prefs.start_paused_enabled ?? false)

  return (
    <SettingSectionCard title={t('downloads.torrentAdding.title')}>
      <SettingSwitchField
        checked={Boolean(prefs.create_subfolder_enabled)}
        id="create_subfolder_enabled"
        label={t('downloads.torrentAdding.createSubfolder')}
        onCheckedChange={(v) =>
          onPrefsChange({ create_subfolder_enabled: Boolean(v) })
        }
      />
      <SettingSwitchField
        checked={startAutomatically}
        id="start-automatically"
        label={t('downloads.torrentAdding.startAutomatically')}
        onCheckedChange={(v) => onPrefsChange({ start_paused_enabled: !v })}
      />
      <SettingSwitchField
        checked={Boolean(prefs.auto_delete_mode)}
        id="auto_delete_mode"
        label={t('downloads.torrentAdding.deleteTorrentFiles')}
        onCheckedChange={(v) => onPrefsChange({ auto_delete_mode: v ? 1 : 0 })}
      />
    </SettingSectionCard>
  )
}
