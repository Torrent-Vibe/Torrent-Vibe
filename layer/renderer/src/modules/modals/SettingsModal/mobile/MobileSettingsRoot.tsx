import * as React from 'react'
import { useTranslation } from 'react-i18next'

import type { SettingsSection } from '../configs'
import {
  getTabConfig,
  SIDEBAR_GROUPS,
} from '../configs'
import {
  createMobileSettingsSection,
  MobileSettingsCells,
  MobileSettingsList,
} from './MobileSettingsList'
import { MobileSettingsScreen } from './MobileSettingsScreen'
import { useStackNavigation } from './MobileStackNavigator'

interface MobileSettingsRootProps {
  onClose?: () => void
  className?: string
  hideHeader?: boolean
}

export const MobileSettingsRoot: React.FC<MobileSettingsRootProps> = ({
  onClose,
  className,
  hideHeader = false,
}) => {
  const { t } = useTranslation('setting')
  const { push } = useStackNavigation()
  const TAB_CONFIG = getTabConfig(t)

  // Handle navigation to settings category
  const handleNavigateToSettings = (settingKey: SettingsSection) => {
    const config = TAB_CONFIG[settingKey]

    push({
      screenId: settingKey,
      title: config.label,
      icon: config.icon,
      data: { settingKey },
    })
  }

  // Create settings sections
  const sections = SIDEBAR_GROUPS.map((group) =>
    createMobileSettingsSection({
      id: group.id,
      title: t(group.translationKey),
      cells: group.keys.map((key) => {
        const config = TAB_CONFIG[key]

        return MobileSettingsCells.button({
          id: key,
          title: config.label,
          subtitle: config.description,
          icon: config.icon,
          iconColor: getIconColor(key),
          onPress: () => handleNavigateToSettings(key),
          showDisclosure: true,
        })
      }),
    }),
  )

  if (hideHeader) {
    // Content-only mode (when header is managed externally)
    return (
      <div className={`h-full w-full bg-background ${className || ''}`}>
        <div className="h-full overflow-auto p-6">
          <MobileSettingsList sections={sections} />
        </div>
      </div>
    )
  }

  return (
    <MobileSettingsScreen
      title="Settings"
      showCloseButton={true}
      onClose={onClose}
      className={className}
      paddingY={false}
    >
      <div className="py-6">
        <MobileSettingsList sections={sections} />
      </div>
    </MobileSettingsScreen>
  )
}

// Helper function to assign colors to setting icons
const getIconColor = (settingKey: SettingsSection): string => {
  const colorMap: Record<SettingsSection, string> = {
    appearance: 'accent',
    apiTokens: 'amber',
    discover: 'sky',
    appConnection: 'green',
    downloads: 'sky', // bg-sky
    connection: 'green', // bg-green
    speed: 'orange', // bg-orange
    bittorrent: 'purple', // bg-purple
    webui: 'cyan', // bg-cyan
    advanced: 'red', // bg-red
    servers: 'indigo', // bg-indigo
    about: 'blue', // bg-blue
  }

  return colorMap[settingKey] || 'gray'
}
