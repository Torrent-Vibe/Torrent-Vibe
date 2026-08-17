import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'

import { TorrentSettings } from '../TorrentSettings'
import type { TorrentFormData, TorrentFormHandlers } from '../types'

interface SettingsSectionProps {
  categories?: Record<string, any> | null
  className?: string
  formData: TorrentFormData
  handlers: TorrentFormHandlers
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
      categories={categories}
      formData={formData}
      handlers={handlers}
    />
  )

  if (!showScrollArea) {
    return <div className={className}>{content}</div>
  }

  return (
    <div className={`min-w-0 h-full relative ${className}`}>
      <ScrollArea
        flex
        rootClassName="flex-1 -mr-6 !absolute inset-0 lg:border-l lg:border-border/50 pl-6"
        scrollbarClassName="mr-2"
        viewportClassName="pr-6"
      >
        {content}
      </ScrollArea>
    </div>
  )
}
