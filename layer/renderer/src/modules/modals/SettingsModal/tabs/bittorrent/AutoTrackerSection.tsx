import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { Textarea } from '~/components/ui/input/Textarea'

import { SettingSectionCard } from '../components'

interface AutoTrackerSectionProps {
  onPrefsChange: (updates: Partial<Preferences>) => void
  prefs: Partial<Preferences>
}

export const AutoTrackerSection = ({
  prefs,
  onPrefsChange,
}: AutoTrackerSectionProps) => {
  const { t } = useTranslation('setting')

  return (
    <SettingSectionCard
      enabled={prefs.add_trackers_enabled ?? false}
      title={t('bittorrent.autoTracker.title')}
      onToggleEnabled={(checked) =>
        onPrefsChange({ add_trackers_enabled: Boolean(checked) })
      }
    >
      <div className="space-y-2">
        <Textarea
          className="h-32 font-mono text-xs"
          placeholder={t('bittorrent.autoTracker.placeholder')}
          rows={8}
          value={prefs.add_trackers ?? ''}
          onChange={(e) => onPrefsChange({ add_trackers: e.target.value })}
        />
        <p className="text-xs text-text-tertiary">
          {t('bittorrent.autoTracker.description')}
        </p>
      </div>
    </SettingSectionCard>
  )
}
