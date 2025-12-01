import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'

import { TorrentSettings } from '../TorrentSettings'
import type { TorrentFormData, TorrentFormHandlers } from '../types'

interface SettingsSectionProps {
  formData: TorrentFormData
  handlers: TorrentFormHandlers
  categories?: Record<string, any> | null
  className?: string
  showScrollArea?: boolean
}

export const SettingsSection = ({
  formData,
  handlers,
  categories,
  className = '',
  showScrollArea = true,
}: SettingsSectionProps) => {
  const content = (
    <TorrentSettings
      formData={formData}
      handlers={handlers}
      categories={categories}
    />
  )

  if (!showScrollArea) {
    return <div className={className}>{content}</div>
  }

  return (
    <div className={`min-w-0 h-full relative ${className}`}>
      <ScrollArea
        rootClassName="flex-1 -mr-6 !absolute inset-0 lg:border-l lg:border-border/50 pl-6"
        flex
        viewportClassName="pr-6"
        scrollbarClassName="mr-2"
      >
        {content}
      </ScrollArea>
    </div>
  )
}
