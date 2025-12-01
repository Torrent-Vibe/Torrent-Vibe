import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { SettingSectionCard, SettingSwitchField } from '../components'

interface TorrentManagementSectionProps {
  prefs: Partial<Preferences>
  onPrefsChange: (updates: Partial<Preferences>) => void
}

export const TorrentManagementSection = ({
  prefs,
  onPrefsChange,
}: TorrentManagementSectionProps) => {
  const { t } = useTranslation('setting')
  return (
    <SettingSectionCard title={t('downloads.management.title')}>
      <SettingSwitchField
        id="preallocate_all"
        label={t('downloads.management.preallocate')}
        checked={Boolean(prefs.preallocate_all)}
        onCheckedChange={(v) => onPrefsChange({ preallocate_all: Boolean(v) })}
      />
      <SettingSwitchField
        id="incomplete_files_ext"
        label={t('downloads.management.incompleteExt')}
        checked={Boolean(prefs.incomplete_files_ext)}
        onCheckedChange={(v) =>
          onPrefsChange({ incomplete_files_ext: Boolean(v) })
        }
      />
      <SettingSwitchField
        id="auto_tmm_enabled"
        label={t('downloads.management.autoTmm')}
        checked={Boolean(prefs.auto_tmm_enabled)}
        onCheckedChange={(v) => onPrefsChange({ auto_tmm_enabled: Boolean(v) })}
      />
      <SettingSwitchField
        id="torrent_changed_tmm_enabled"
        label={t('downloads.management.categoryChanged')}
        checked={Boolean(prefs.torrent_changed_tmm_enabled)}
        onCheckedChange={(v) =>
          onPrefsChange({ torrent_changed_tmm_enabled: Boolean(v) })
        }
      />
      <SettingSwitchField
        id="save_path_changed_tmm_enabled"
        label={t('downloads.management.savePathChanged')}
        checked={Boolean(prefs.save_path_changed_tmm_enabled)}
        onCheckedChange={(v) =>
          onPrefsChange({ save_path_changed_tmm_enabled: Boolean(v) })
        }
      />
      <SettingSwitchField
        id="category_changed_tmm_enabled"
        label={t('downloads.management.categorySavePathChanged')}
        checked={Boolean(prefs.category_changed_tmm_enabled)}
        onCheckedChange={(v) =>
          onPrefsChange({ category_changed_tmm_enabled: Boolean(v) })
        }
      />
    </SettingSectionCard>
  )
}
