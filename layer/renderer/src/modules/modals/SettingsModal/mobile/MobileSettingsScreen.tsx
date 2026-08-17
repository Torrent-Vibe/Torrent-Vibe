import * as React from 'react'

import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import { cn } from '~/lib/cn'

import {
  MobileSettingsHeader,
  MobileSettingsHeaderWithClose,
} from './MobileSettingsHeader'

interface MobileSettingsScreenProps {
  children: React.ReactNode
  className?: string

  // Custom header component
  customHeader?: React.ReactNode
  fullHeight?: boolean
  headerRightContent?: React.ReactNode
  hideHeader?: boolean

  onBackPress?: () => void
  onClose?: () => void

  paddingX?: boolean
  paddingY?: boolean
  // Layout options
  scrollable?: boolean
  showBackButton?: boolean

  // Close button (for root screens)
  showCloseButton?: boolean
  // Header props
  title?: string
}

export const MobileSettingsScreen: React.FC<MobileSettingsScreenProps> = ({
  children,
  className,
  title,
  showBackButton,
  headerRightContent,
  onBackPress,
  showCloseButton = false,
  onClose,
  scrollable = true,
  fullHeight = true,
  paddingX = true,
  paddingY = true,
  customHeader,
  hideHeader = false,
}) => {
  const hasCloseButton = showCloseButton && onClose

  // Render appropriate header
  const renderHeader = () => {
    if (hideHeader) return null

    if (customHeader) {
      return customHeader
    }

    if (hasCloseButton) {
      return (
        <MobileSettingsHeaderWithClose
          showBackButton={showBackButton}
          showCloseButton={showCloseButton}
          title={title}
          onBackPress={onBackPress}
          onClose={onClose}
        />
      )
    }

    return (
      <MobileSettingsHeader
        rightContent={headerRightContent}
        showBackButton={showBackButton}
        title={title}
        onBackPress={onBackPress}
      />
    )
  }

  const contentClasses = cn('flex-1', {
    'overflow-hidden': fullHeight,
  })

  const innerContentClasses = cn({
    'px-4': paddingX,
    'py-4': paddingY,
    'h-full': fullHeight,
  })

  return (
    <div className={cn('flex flex-col h-full w-full bg-background', className)}>
      {/* Header */}
      {renderHeader()}

      {/* Content */}
      <div className={contentClasses}>
        {scrollable ? (
          <ScrollArea
            flex
            rootClassName="h-full"
            viewportClassName={innerContentClasses}
          >
            {children}
          </ScrollArea>
        ) : (
          <div className={innerContentClasses}>{children}</div>
        )}
      </div>
    </div>
  )
}

// Screen content helpers
export const MobileSettingsContent = {
  // Section wrapper with proper spacing
  Section: ({
    children,
    title,
    className,
  }: {
    children: React.ReactNode
    title?: string
    className?: string
  }) => (
    <section className={cn('space-y-4', className)}>
      {title && (
        <h2 className="text-lg font-semibold text-text mb-3">{title}</h2>
      )}
      {children}
    </section>
  ),

  // Multiple sections with dividers
  SectionList: ({
    sections,
    className,
  }: {
    sections: Array<{ title?: string; content: React.ReactNode }>
    className?: string
  }) => (
    <div className={cn('space-y-8', className)}>
      {sections.map((section, index) => (
        <MobileSettingsContent.Section key={index} title={section.title}>
          {section.content}
        </MobileSettingsContent.Section>
      ))}
    </div>
  ),

  // Empty state
  EmptyState: ({
    title,
    description,
    icon,
    action,
  }: {
    title: string
    description?: string
    icon?: string
    action?: React.ReactNode
  }) => (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-sm mx-auto px-6">
        {icon && <i className={cn('text-5xl text-text-tertiary mb-4', icon)} />}
        <h3 className="text-xl font-semibold text-text mb-2">{title}</h3>
        {description && (
          <p className="text-text-secondary leading-relaxed mb-6">
            {description}
          </p>
        )}
        {action}
      </div>
    </div>
  ),
}
