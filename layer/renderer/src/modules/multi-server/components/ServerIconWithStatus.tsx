import * as React from 'react'

import type { StatusVariant } from '~/components/ui/status-dot'
import { StatusDot } from '~/components/ui/status-dot'

interface ServerIconWithStatusProps {
  variant: StatusVariant
  size?: 'sm' | 'md'
  title?: string
  className?: string
  iconClassName?: string
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
        <StatusDot variant={variant} size={size} title={title} />
      </span>
    </span>
  )
}
