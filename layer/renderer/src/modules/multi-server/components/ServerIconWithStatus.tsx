import * as React from 'react'

import type { StatusVariant } from '~/components/ui/status-dot'
import { StatusDot } from '~/components/ui/status-dot'

interface ServerIconWithStatusProps {
  className?: string
  iconClassName?: string
  size?: 'sm' | 'md'
  title?: string
  variant: StatusVariant
}

export const ServerIconWithStatus: React.FC<ServerIconWithStatusProps> = ({
  variant,
  size = 'md',
  title,
  className,
  iconClassName,
}) => {
  return (
    <span
      className={['relative inline-flex items-center', className]
        .filter(Boolean)
        .join(' ')}
    >
      <i
        className={['i-mingcute-server-2-line text-sm', iconClassName]
          .filter(Boolean)
          .join(' ')}
      />
      <span className="absolute -right-0.5 -top-2">
        <StatusDot size={size} title={title} variant={variant} />
      </span>
    </span>
  )
}
