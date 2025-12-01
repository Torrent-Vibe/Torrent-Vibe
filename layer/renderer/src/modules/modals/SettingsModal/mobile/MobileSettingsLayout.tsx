import * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getTabConfig } from '../configs'
import type { MobileNavigationScreen } from './mobile-navigation-store'
import { useMobileNavigationStore } from './mobile-navigation-store'
import { MobileNavigationProvider } from './MobileNavigationProvider'
import { MobileSettingsNavigationBar } from './MobileSettingsNavigationBar'
import { MobileSettingsRoot } from './MobileSettingsRoot'
import { MobileSettingsTabWrapper } from './MobileSettingsTabWrapper'
import { MobileStackNavigator } from './MobileStackNavigator'

interface MobileSettingsLayoutProps {
  onClose?: () => void
  className?: string
  initialTab?: import('../configs').SettingsSection
}

/**
 * Main layout for mobile settings with single navigation bar instance
 * Similar to UINavigationController architecture
 */
export const MobileSettingsLayout: React.FC<MobileSettingsLayoutProps> = ({
  onClose,
  className,
  initialTab,
}) => {
  const { t } = useTranslation('setting')
  const tabConfig = useMemo(() => getTabConfig(t), [t])
  const push = useMobileNavigationStore((state) => state.push)
  const screens = useMobileNavigationStore((state) => state.screens)
  const [initialTabPushed, setInitialTabPushed] = useState(false)

  // Screen renderer - only renders content (no headers)
  const renderScreen = useCallback(
    (screen: MobileNavigationScreen): React.ReactNode => {
      switch (screen.screenId) {
        case 'root': {
          return <MobileSettingsRootContent onClose={onClose} />
        }

        case 'appearance':
        case 'discover':
        case 'appConnection':
        case 'downloads':
        case 'connection':
        case 'speed':
        case 'bittorrent':
        case 'webui':
        case 'servers':
        case 'about':
        case 'advanced': {
          return <MobileSettingsTabContent settingKey={screen.screenId} />
        }

        default: {
          return (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-sm mx-auto">
                <i className="i-mingcute-alert-line text-5xl text-red mb-6" />
                <h3 className="text-xl font-semibold text-text mb-3">
                  Screen Not Found
                </h3>
                <p className="text-text-secondary leading-relaxed">
                  The requested settings screen could not be found.
                </p>
              </div>
            </div>
          )
        }
      }
    },
    [onClose],
  )

  // Initial screen configuration
  const initialScreen = {
    screenId: 'root' as const,
    title: 'Settings',
    icon: 'i-mingcute-settings-3-line',
  }

  useEffect(() => {
    if (!initialTab || initialTabPushed) return
    if (screens.length === 1 && screens[0]?.screenId === 'root') {
      const tab = tabConfig[initialTab]
      if (tab) {
        push({
          screenId: initialTab,
          title: tab.label,
          icon: tab.icon,
          data: { settingKey: initialTab },
        })
        setInitialTabPushed(true)
      }
    }
  }, [initialTab, initialTabPushed, push, screens, tabConfig])

  return (
    <div
      className={`h-full w-full bg-background text-text flex flex-col ${className || ''}`}
    >
      <MobileNavigationProvider
        initialScreen={initialScreen}
        onBackAction={onClose}
      >
        {/* Single Navigation Bar Instance */}
        <MobileSettingsNavigationBar onClose={onClose} />

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          <MobileStackNavigator
            renderScreen={renderScreen}
            className="h-full"
          />
        </div>
      </MobileNavigationProvider>
    </div>
  )
}

// Content-only versions of screens (without headers)
const MobileSettingsRootContent: React.FC<{ onClose?: () => void }> = ({
  onClose,
}) => {
  return <MobileSettingsRoot onClose={onClose} hideHeader />
}

const MobileSettingsTabContent: React.FC<{ settingKey: string }> = ({
  settingKey,
}) => {
  return <MobileSettingsTabWrapper settingKey={settingKey as any} hideHeader />
}

export default MobileSettingsLayout
