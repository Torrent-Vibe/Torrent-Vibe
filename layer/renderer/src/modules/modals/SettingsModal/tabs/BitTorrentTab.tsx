import { toast } from 'sonner'

import { useQBittorrentPrefsManager } from '~/atoms/settings/qbittorrent-prefs'
import { getI18n } from '~/i18n'

import { AutoTrackerSection } from './bittorrent/AutoTrackerSection'
import { PrivacySection } from './bittorrent/PrivacySection'
import { SeedingLimitsSection } from './bittorrent/SeedingLimitsSection'
import { TorrentQueuingSection } from './bittorrent/TorrentQueuingSection'
import { PrefsTabLayout } from './components/PrefsTabLayout'

export const BitTorrentTab = () => {
  const {
    prefs,
    update: handlePrefsChange,
    isLoading: loadingPrefs,
    error,
  } = useQBittorrentPrefsManager()

  if (error) {
    toast.error(getI18n().t('messages.preferencesLoadFailed'))
  }

  return (
    <PrefsTabLayout
      saveSuccessI18nKey="messages.bittorrentSaved"
      saveErrorI18nKey="messages.bittorrentSaveFailed"
    >
      {loadingPrefs && (
        <div className="text-xs text-text-tertiary flex items-center gap-2">
          <i className="i-mingcute-loading-3-line animate-spin" />
          Loading preferences...
        </div>
      )}

      <PrivacySection prefs={prefs} onPrefsChange={handlePrefsChange} />
      <TorrentQueuingSection prefs={prefs} onPrefsChange={handlePrefsChange} />
      <SeedingLimitsSection prefs={prefs} onPrefsChange={handlePrefsChange} />
      <AutoTrackerSection prefs={prefs} onPrefsChange={handlePrefsChange} />
    </PrefsTabLayout>
  )
}
