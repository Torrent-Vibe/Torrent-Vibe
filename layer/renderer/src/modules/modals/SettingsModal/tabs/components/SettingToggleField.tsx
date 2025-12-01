import type { PropsWithChildren, ReactNode } from 'react'

import { Switch } from '~/components/ui/switch'
import { cn } from '~/lib/cn'

import { SettingField } from './SettingField'

interface SettingToggleFieldProps extends PropsWithChildren {
  label: ReactNode
  description?: ReactNode
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  contentClassName?: string
}

// A row with left label, right content area and a switch pinned to the far right
export const SettingToggleField = ({
  label,
  description,
  enabled,
  onEnabledChange,
  children,
  contentClassName,
}: SettingToggleFieldProps) => {
  return (
    <SettingField label={label} description={description}>
      <div className="flex items-center justify-between w-full">
        <div
          className={cn(
            'flex items-center gap-2 mr-3 flex-1',
            {
              'opacity-50 pointer-events-none select-none': !enabled,
            },
            contentClassName,
          )}
        >
          {children}
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => onEnabledChange(Boolean(v))}
        />
      </div>
    </SettingField>
  )
}
