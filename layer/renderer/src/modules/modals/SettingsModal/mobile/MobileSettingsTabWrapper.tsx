import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'

import type { SettingsSection } from '../configs'
import { getTabConfig } from '../configs'
import { MobileSettingsScreen } from './MobileSettingsScreen'

interface MobileSettingsTabWrapperProps {
  settingKey: SettingsSection
  className?: string
  hideHeader?: boolean
}

export const MobileSettingsTabWrapper: React.FC<
  MobileSettingsTabWrapperProps
> = ({ settingKey, className, hideHeader = false }) => {
  const { t } = useTranslation('setting')
  const TAB_CONFIG = getTabConfig(t)
  const config = TAB_CONFIG[settingKey]

  if (!config) {
    const errorContent = (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <i className="i-mingcute-alert-line text-4xl text-text-tertiary mb-4" />
          <h3 className="text-lg font-semibold text-text mb-2">
            Settings Not Found
          </h3>
          <p className="text-text-secondary">
            The requested settings page could not be found.
          </p>
        </div>
      </div>
    )

    if (hideHeader) {
      return (
        <div className={`h-full w-full bg-background ${className || ''}`}>
          {errorContent}
        </div>
      )
    }

    return (
      <MobileSettingsScreen title="Settings" className={className}>
        {errorContent}
      </MobileSettingsScreen>
    )
  }

  const content = (
    <div className="flex-1 flex flex-col">
      {/* Settings Content */}
      <div className="flex-1 px-4 py-6">
        <config.Component />
      </div>
    </div>
  )

  if (hideHeader) {
    return (
      <div className={`h-full w-full bg-background ${className || ''}`}>
        <ScrollArea flex rootClassName="h-full" viewportClassName="h-full">
          {content}
        </ScrollArea>
      </div>
    )
  }

  return (
    <MobileSettingsScreen
      title={config.label}
      className={className}
      paddingY={false}
    >
      {content}
    </MobileSettingsScreen>
  )
}
