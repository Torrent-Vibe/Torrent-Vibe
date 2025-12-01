import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { Textarea } from '~/components/ui/input/Textarea'

import { SettingSectionCard } from '../components'

interface AutoTrackerSectionProps {
  prefs: Partial<Preferences>
  onPrefsChange: (updates: Partial<Preferences>) => void
}

export const AutoTrackerSection = ({
  prefs,
  onPrefsChange,
}: AutoTrackerSectionProps) => {
  const { t } = useTranslation('setting')

  return (
    <SettingSectionCard
      title={t('bittorrent.autoTracker.title')}
      enabled={prefs.add_trackers_enabled ?? false}
      onToggleEnabled={(checked) =>
        onPrefsChange({ add_trackers_enabled: Boolean(checked) })
      }
    >
      <div className="space-y-2">
        <Textarea
          value={prefs.add_trackers ?? ''}
          onChange={(e) => onPrefsChange({ add_trackers: e.target.value })}
          placeholder={t('bittorrent.autoTracker.placeholder')}
          className="h-32 font-mono text-xs"
          rows={8}
        />
        <p className="text-xs text-text-tertiary">
          {t('bittorrent.autoTracker.description')}
        </p>
      </div>
    </SettingSectionCard>
  )
}
