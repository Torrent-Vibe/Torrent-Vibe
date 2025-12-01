import * as React from 'react'

export type StatusVariant = 'success' | 'warning' | 'danger' | 'unknown'

interface StatusDotProps {
  variant: StatusVariant
  size?: 'sm' | 'md'
  title?: string
  className?: string
}

const variantToBgClass: Record<StatusVariant, string> = {
  success: 'bg-green',
  warning: 'bg-orange',
  danger: 'bg-red',
  // Use semantic fill for unknown per Pastel system
  unknown: 'bg-fill-quaternary',
}

const sizeToDimensionClass: Record<
  NonNullable<StatusDotProps['size']>,
  string
> = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
}

export const StatusDot: React.FC<StatusDotProps> = ({
  variant,
  size = 'md',
  title,
  className,
}) => {
  const classes = [
    'inline-block rounded-full',
    sizeToDimensionClass[size],
    variantToBgClass[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <span className={classes} title={title} />
}

export default StatusDot
