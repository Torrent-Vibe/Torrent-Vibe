import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { SettingSectionCard, SettingSwitchField } from '../components'

interface TorrentAddingSectionProps {
  prefs: Partial<Preferences>
  onPrefsChange: (updates: Partial<Preferences>) => void
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
        id="create_subfolder_enabled"
        label={t('downloads.torrentAdding.createSubfolder')}
        checked={Boolean(prefs.create_subfolder_enabled)}
        onCheckedChange={(v) =>
          onPrefsChange({ create_subfolder_enabled: Boolean(v) })
        }
      />
      <SettingSwitchField
        id="start-automatically"
        label={t('downloads.torrentAdding.startAutomatically')}
        checked={startAutomatically}
        onCheckedChange={(v) => onPrefsChange({ start_paused_enabled: !v })}
      />
      <SettingSwitchField
        id="auto_delete_mode"
        label={t('downloads.torrentAdding.deleteTorrentFiles')}
        checked={Boolean(prefs.auto_delete_mode)}
        onCheckedChange={(v) => onPrefsChange({ auto_delete_mode: v ? 1 : 0 })}
      />
    </SettingSectionCard>
  )
}
