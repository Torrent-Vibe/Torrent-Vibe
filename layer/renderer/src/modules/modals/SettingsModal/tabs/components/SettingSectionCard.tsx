import type { PropsWithChildren, ReactNode } from 'react'

import { cn } from '~/lib/cn'

import { SettingSwitchField } from './SettingSwitchField'

interface SettingSectionCardProps extends PropsWithChildren {
  className?: string
  description?: ReactNode
  enabled?: boolean
  headerAction?: ReactNode
  onToggleEnabled?: (enabled: boolean) => void
  // If provided, renders a switch in the header and disables content when false
  switchLabel?: ReactNode
  title: ReactNode
}

export const SettingSectionCard = ({
  title,
  description,
  className,
  switchLabel,
  enabled,
  onToggleEnabled,
  headerAction,
  children,
}: SettingSectionCardProps) => {
  const hasSwitch = typeof enabled === 'boolean' && !!onToggleEnabled
  const headerExtras: ReactNode[] = []

  if (headerAction) {
    headerExtras.push(
      <div className="flex-shrink-0" key="action">
        {headerAction}
      </div>,
    )
  }

  if (hasSwitch) {
    headerExtras.push(
      <div className="flex-shrink-0" key="switch">
        <SettingSwitchField
          checked={!!enabled}
          label={switchLabel ?? ''}
          onCheckedChange={(v) => onToggleEnabled?.(!!v)}
        />
      </div>,
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-medium text-text">{title}</h3>
          {description ? (
            <p className="text-xs text-text-secondary mt-1">{description}</p>
          ) : null}
        </div>
        {headerExtras.length > 0 && (
          <div className="ml-4 flex items-center gap-3">{headerExtras}</div>
        )}
      </div>

      <div
        aria-disabled={hasSwitch && !enabled}
        className={cn({
          'opacity-50 pointer-events-none select-none': hasSwitch && !enabled,
        })}
      >
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  )
}
