import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { SettingSectionCard, SettingSwitchField } from '../components'

interface TorrentManagementSectionProps {
  onPrefsChange: (updates: Partial<Preferences>) => void
  prefs: Partial<Preferences>
}

export const TorrentManagementSection = ({
  prefs,
  onPrefsChange,
}: TorrentManagementSectionProps) => {
  const { t } = useTranslation('setting')
  return (
    <SettingSectionCard title={t('downloads.management.title')}>
      <SettingSwitchField
        checked={Boolean(prefs.preallocate_all)}
        id="preallocate_all"
        label={t('downloads.management.preallocate')}
        onCheckedChange={(v) => onPrefsChange({ preallocate_all: Boolean(v) })}
      />
      <SettingSwitchField
        checked={Boolean(prefs.incomplete_files_ext)}
        id="incomplete_files_ext"
        label={t('downloads.management.incompleteExt')}
        onCheckedChange={(v) =>
          onPrefsChange({ incomplete_files_ext: Boolean(v) })
        }
      />
      <SettingSwitchField
        checked={Boolean(prefs.auto_tmm_enabled)}
        id="auto_tmm_enabled"
        label={t('downloads.management.autoTmm')}
        onCheckedChange={(v) => onPrefsChange({ auto_tmm_enabled: Boolean(v) })}
      />
      <SettingSwitchField
        checked={Boolean(prefs.torrent_changed_tmm_enabled)}
        id="torrent_changed_tmm_enabled"
        label={t('downloads.management.categoryChanged')}
        onCheckedChange={(v) =>
          onPrefsChange({ torrent_changed_tmm_enabled: Boolean(v) })
        }
      />
      <SettingSwitchField
        checked={Boolean(prefs.save_path_changed_tmm_enabled)}
        id="save_path_changed_tmm_enabled"
        label={t('downloads.management.savePathChanged')}
        onCheckedChange={(v) =>
          onPrefsChange({ save_path_changed_tmm_enabled: Boolean(v) })
        }
      />
      <SettingSwitchField
        checked={Boolean(prefs.category_changed_tmm_enabled)}
        id="category_changed_tmm_enabled"
        label={t('downloads.management.categorySavePathChanged')}
        onCheckedChange={(v) =>
          onPrefsChange({ category_changed_tmm_enabled: Boolean(v) })
        }
      />
    </SettingSectionCard>
  )
}
