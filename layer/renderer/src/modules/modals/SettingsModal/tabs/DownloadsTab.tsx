import { toast } from 'sonner'

import { useQBittorrentPrefsManager } from '~/atoms/settings/qbittorrent-prefs'
import { getI18n } from '~/i18n'

import { PrefsTabLayout } from './components/PrefsTabLayout'
import { EmailNotificationSection } from './downloads/EmailNotificationSection'
import { ExternalProgramsSection } from './downloads/ExternalProgramsSection'
import { FilePathsSection } from './downloads/FilePathsSection'
import { MonitoredFoldersSection } from './downloads/MonitoredFoldersSection'
import { TorrentAddingSection } from './downloads/TorrentAddingSection'
import { TorrentManagementSection } from './downloads/TorrentManagementSection'

export const DownloadsTab = () => {
  const {
    prefs,
    update: handlePrefsChange,
    isLoading: loadingPrefs,
    error,
  } = useQBittorrentPrefsManager()

  // Show error toast if query fails
  if (error) {
    toast.error(getI18n().t('messages.preferencesLoadFailed'))
  }

  return (
    <PrefsTabLayout
      saveSuccessI18nKey="messages.preferencesSaved"
      saveErrorI18nKey="messages.preferencesSaveFailed"
    >
      {loadingPrefs && (
        <div className="text-xs text-text-tertiary flex items-center gap-2">
          <i className="i-mingcute-loading-3-line animate-spin" />
          Loading preferences...
        </div>
      )}

      <TorrentAddingSection prefs={prefs} onPrefsChange={handlePrefsChange} />
      <TorrentManagementSection
        prefs={prefs}
        onPrefsChange={handlePrefsChange}
      />
      <FilePathsSection prefs={prefs} onPrefsChange={handlePrefsChange} />
      <MonitoredFoldersSection prefs={prefs} />
      <EmailNotificationSection
        prefs={prefs}
        onPrefsChange={handlePrefsChange}
      />
      <ExternalProgramsSection
        prefs={prefs}
        onPrefsChange={handlePrefsChange}
      />
    </PrefsTabLayout>
  )
}
