import { toast } from 'sonner'

import { useQBittorrentPrefsManager } from '~/atoms/settings/qbittorrent-prefs'
import { getI18n } from '~/i18n'

import { PrefsTabLayout } from './components/PrefsTabLayout'
import { ConnectionLimitsSection } from './connection/ConnectionLimitsSection'
import { I2PSection } from './connection/I2PSection'
import { IPFilteringSection } from './connection/IPFilteringSection'
import { ListeningPortSection } from './connection/ListeningPortSection'
import { PeerConnectionSection } from './connection/PeerConnectionSection'
import { ProxyServerSection } from './connection/ProxyServerSection'

export const ConnectionTab = () => {
  const {
    prefs,
    update: handlePrefsChange,
    isLoading: loadingPrefs,
    error,
  } = useQBittorrentPrefsManager()

  // Show error toast if query fails
  if (error) {
    toast.error(getI18n().t('messages.connectionLoadFailed'))
  }

  return (
    <PrefsTabLayout
      saveSuccessI18nKey="messages.connectionSaved"
      saveErrorI18nKey="messages.connectionSaveFailed"
    >
      {loadingPrefs && (
        <div className="text-xs text-text-tertiary flex items-center gap-2">
          <i className="i-mingcute-loading-3-line animate-spin" />
          Loading preferences...
        </div>
      )}

      <PeerConnectionSection prefs={prefs} onPrefsChange={handlePrefsChange} />
      <ListeningPortSection prefs={prefs} onPrefsChange={handlePrefsChange} />
      <ConnectionLimitsSection
        prefs={prefs}
        onPrefsChange={handlePrefsChange}
      />
      <I2PSection prefs={prefs} onPrefsChange={handlePrefsChange} />
      <ProxyServerSection prefs={prefs} onPrefsChange={handlePrefsChange} />
      <IPFilteringSection prefs={prefs} onPrefsChange={handlePrefsChange} />
    </PrefsTabLayout>
  )
}
