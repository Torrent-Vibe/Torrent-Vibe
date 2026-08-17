import { toast } from 'sonner'

import { useQBittorrentPrefsManager } from '~/atoms/settings/qbittorrent-prefs'
import { getI18n } from '~/i18n'

import { LibtorrentAdvancedSection } from './advanced/LibtorrentAdvancedSection'
import { QBittorrentAdvancedSection } from './advanced/QBittorrentAdvancedSection'
import { PrefsTabLayout } from './components/PrefsTabLayout'

export const AdvancedTab = () => {
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
      saveErrorI18nKey="messages.advancedSaveFailed"
      saveSuccessI18nKey="messages.advancedSaved"
    >
      {loadingPrefs && (
        <div className="text-xs text-text-tertiary flex items-center gap-2">
          <i className="i-mingcute-loading-3-line animate-spin" />
          Loading preferences...
        </div>
      )}

      <QBittorrentAdvancedSection
        prefs={prefs}
        onPrefsChange={handlePrefsChange}
      />
      <LibtorrentAdvancedSection
        prefs={prefs}
        onPrefsChange={handlePrefsChange}
      />
    </PrefsTabLayout>
  )
}
