import * as React from 'react'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Switch } from '~/components/ui/switch'
import { cn } from '~/lib/cn'

// Base cell interface
interface BaseMobileSettingsCell {
  id: string
  title: string
  subtitle?: string
  icon?: string
  iconColor?: string
  disabled?: boolean
  className?: string
}

// Cell type definitions
export interface MobileSettingsCellButton extends BaseMobileSettingsCell {
  type: 'button'
  onPress: () => void
  showDisclosure?: boolean
  rightContent?: React.ReactNode
}

export interface MobileSettingsCellSwitch extends BaseMobileSettingsCell {
  type: 'switch'
  value: boolean
  onChange: (value: boolean) => void
}

export interface MobileSettingsCellInput extends BaseMobileSettingsCell {
  type: 'input'
  value: string
  placeholder?: string
  onChange: (value: string) => void
  inputType?: 'text' | 'number' | 'password' | 'email'
  rightContent?: React.ReactNode
}

export interface MobileSettingsCellValue extends BaseMobileSettingsCell {
  type: 'value'
  value: string
  onPress?: () => void
  showDisclosure?: boolean
}

export interface MobileSettingsCellCustom extends BaseMobileSettingsCell {
  type: 'custom'
  children: React.ReactNode
  onPress?: () => void
}

export type MobileSettingsCell =
  | MobileSettingsCellButton
  | MobileSettingsCellSwitch
  | MobileSettingsCellInput
  | MobileSettingsCellValue
  | MobileSettingsCellCustom

// Section interface
export interface MobileSettingsSection {
  id: string
  title?: string
  description?: string
  cells: MobileSettingsCell[]
}

// Main list component props
interface MobileSettingsListProps {
  sections: MobileSettingsSection[]
  className?: string
}

export const MobileSettingsList: React.FC<MobileSettingsListProps> = ({
  sections,
  className,
}) => {
  return (
    <div className={cn('space-y-8', className)}>
      {sections.map((section, sectionIndex) => (
        <MobileSettingsSection
          key={section.id}
          section={section}
          isFirst={sectionIndex === 0}
          isLast={sectionIndex === sections.length - 1}
        />
      ))}
    </div>
  )
}

// Section component
interface MobileSettingsSectionProps {
  section: MobileSettingsSection
  isFirst: boolean
  isLast: boolean
}

const MobileSettingsSection: React.FC<MobileSettingsSectionProps> = ({
  section,
  isFirst,
  isLast,
}) => {
  return (
    <div className={cn('space-y-2', { 'mt-0': isFirst, 'mb-0': isLast })}>
      {/* Section header */}
      {section.title && (
        <div className="px-4">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide">
            {section.title}
          </h3>
        </div>
      )}

      {/* Section cells */}
      <div className="bg-material-ultra-thin rounded-xl overflow-hidden">
        {section.cells.map((cell, cellIndex) => (
          <MobileSettingsCell
            key={cell.id}
            cell={cell}
            isFirst={cellIndex === 0}
            isLast={cellIndex === section.cells.length - 1}
          />
        ))}
      </div>

      {/* Section description */}
      {section.description && (
        <div className="px-4 pt-1">
          <p className="text-xs text-text-tertiary leading-relaxed">
            {section.description}
          </p>
        </div>
      )}
    </div>
  )
}

// Individual cell component
interface MobileSettingsCellProps {
  cell: MobileSettingsCell
  isFirst: boolean
  isLast: boolean
}

const MobileSettingsCell: React.FC<MobileSettingsCellProps> = ({
  cell,

  isLast,
}) => {
  const baseClasses = cn(
    'flex items-center px-4 py-3 min-h-[50px]',
    'border-b border-border/30',
    {
      'border-b-0': isLast,
    },
    cell.disabled && 'opacity-60 cursor-not-allowed',
    cell.className,
  )

  const renderIcon = () => {
    if (!cell.icon) return null

    return (
      <div className="mr-3 flex-shrink-0">
        <div
          className={cn(
            'w-7 h-7 rounded-md flex items-center justify-center',
            cell.iconColor
              ? `bg-${cell.iconColor} text-white`
              : 'bg-fill text-text-secondary',
          )}
        >
          <i className={cn(cell.icon, 'text-sm')} />
        </div>
      </div>
    )
  }

  const renderContent = () => {
    switch (cell.type) {
      case 'button': {
        return (
          <Button
            variant="ghost"
            className={cn(
              baseClasses,
              'w-full justify-start hover:bg-fill/50 active:bg-fill',
              !cell.disabled && 'cursor-pointer',
            )}
            onClick={cell.onPress}
            disabled={cell.disabled}
          >
            {renderIcon()}
            <div className="flex-1 min-w-0">
              <div className="text-left">
                <div className="text-text font-medium truncate">
                  {cell.title}
                </div>
                {cell.subtitle && (
                  <div className="text-sm text-text-tertiary min-w-0 truncate mt-0.5">
                    {cell.subtitle}
                  </div>
                )}
              </div>
            </div>
            {cell.rightContent && (
              <div className="ml-3 flex-shrink-0">{cell.rightContent}</div>
            )}
            {(cell.showDisclosure ||
              (!cell.rightContent && cell.showDisclosure !== false)) && (
              <div className="ml-2 flex-shrink-0">
                <i className="i-mingcute-arrow-right-line text-text-tertiary text-sm" />
              </div>
            )}
          </Button>
        )
      }

      case 'switch': {
        return (
          <div className={baseClasses}>
            {renderIcon()}
            <div className="flex-1 min-w-0">
              <div className="text-text font-medium truncate">{cell.title}</div>
              {cell.subtitle && (
                <div className="text-sm text-text-secondary truncate mt-0.5">
                  {cell.subtitle}
                </div>
              )}
            </div>
            <div className="ml-3 flex-shrink-0">
              <Switch
                checked={cell.value}
                onCheckedChange={cell.onChange}
                disabled={cell.disabled}
              />
            </div>
          </div>
        )
      }

      case 'input': {
        return (
          <div className={baseClasses}>
            {renderIcon()}
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className="min-w-0 flex-shrink-0">
                <div className="text-text font-medium truncate">
                  {cell.title}
                </div>
                {cell.subtitle && (
                  <div className="text-sm text-text-secondary truncate mt-0.5">
                    {cell.subtitle}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Input
                  value={cell.value}
                  onChange={(e) => cell.onChange(e.target.value)}
                  placeholder={cell.placeholder}
                  type={cell.inputType || 'text'}
                  disabled={cell.disabled}
                  className="border-none bg-transparent px-0 text-right"
                />
              </div>
              {cell.rightContent && (
                <div className="flex-shrink-0">{cell.rightContent}</div>
              )}
            </div>
          </div>
        )
      }

      case 'value': {
        const ValueComponent = cell.onPress ? Button : 'div'
        const valueProps = cell.onPress
          ? {
              variant: 'ghost' as const,
              onClick: cell.onPress,
              disabled: cell.disabled,
              className: cn(
                baseClasses,
                'w-full justify-start hover:bg-fill/50 active:bg-fill',
              ),
            }
          : {
              className: baseClasses,
            }

        return (
          <ValueComponent {...valueProps}>
            {renderIcon()}
            <div className="flex-1 min-w-0">
              <div className="text-text font-medium truncate">{cell.title}</div>
              {cell.subtitle && (
                <div className="text-sm text-text-secondary truncate mt-0.5">
                  {cell.subtitle}
                </div>
              )}
            </div>
            <div className="ml-3 flex-shrink-0 text-text-secondary">
              {cell.value}
            </div>
            {cell.onPress && cell.showDisclosure !== false && (
              <div className="ml-2 flex-shrink-0">
                <i className="i-mingcute-arrow-right-line text-text-tertiary text-sm" />
              </div>
            )}
          </ValueComponent>
        )
      }

      case 'custom': {
        const CustomComponent = cell.onPress ? Button : 'div'
        const customProps = cell.onPress
          ? {
              variant: 'ghost' as const,
              onClick: cell.onPress,
              disabled: cell.disabled,
              className: cn(
                baseClasses,
                'w-full justify-start hover:bg-fill/50 active:bg-fill',
              ),
            }
          : {
              className: baseClasses,
            }

        return (
          <CustomComponent {...customProps}>
            {renderIcon()}
            <div className="flex-1 min-w-0">
              <div className="text-text font-medium truncate">{cell.title}</div>
              {cell.subtitle && (
                <div className="text-sm text-text-secondary truncate mt-0.5">
                  {cell.subtitle}
                </div>
              )}
            </div>
            <div className="flex-shrink-0">{cell.children}</div>
          </CustomComponent>
        )
      }

      default: {
        return null
      }
    }
  }

  return <>{renderContent()}</>
}

// Utility helpers for creating cells
export const MobileSettingsCells = {
  button: (
    props: Omit<MobileSettingsCellButton, 'type'>,
  ): MobileSettingsCellButton => ({
    type: 'button',
    ...props,
  }),

  switch: (
    props: Omit<MobileSettingsCellSwitch, 'type'>,
  ): MobileSettingsCellSwitch => ({
    type: 'switch',
    ...props,
  }),

  input: (
    props: Omit<MobileSettingsCellInput, 'type'>,
  ): MobileSettingsCellInput => ({
    type: 'input',
    ...props,
  }),

  value: (
    props: Omit<MobileSettingsCellValue, 'type'>,
  ): MobileSettingsCellValue => ({
    type: 'value',
    ...props,
  }),

  custom: (
    props: Omit<MobileSettingsCellCustom, 'type'>,
  ): MobileSettingsCellCustom => ({
    type: 'custom',
    ...props,
  }),
}

// Section helper
export const createMobileSettingsSection = (
  props: Omit<MobileSettingsSection, 'id'> & { id?: string },
): MobileSettingsSection => ({
  id:
    props.id ||
    `section_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
  ...props,
})
