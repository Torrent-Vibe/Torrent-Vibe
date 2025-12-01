import clsx from 'clsx'
import { m } from 'motion/react'
import type { ReactNode, Ref } from 'react'
import { useId } from 'react'

import { cn } from '~/lib/cn'

export interface SegmentTabItem<T = string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

export interface SegmentTabProps<T = string> {
  items: SegmentTabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  containerClassName?: string
  activeClassName?: string
  inactiveClassName?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'compact'
  disabled?: boolean
  responsiveWrap?: boolean
  ref?: Ref<HTMLDivElement>
}

const sizeClasses = {
  default: {
    // iOS-like compact heights and rounded pill look
    sm: 'h-7 px-3 text-xs',
    md: 'h-8 px-4 text-sm',
    lg: 'h-10 px-5 text-base',
  },
  compact: {
    sm: 'h-7 px-2.5 text-xs',
    md: 'h-8 px-3 text-sm',
    lg: 'h-9 px-4 text-base',
  },
} as const

const variantClasses = {
  default: {
    container:
      'p-1 rounded-lg border border-border backdrop-blur bg-material-medium',
    button: 'rounded-lg',
    indicator:
      'bg-background-secondary rounded-lg border border-border shadow-sm',
  },
  compact: {
    container:
      'px-1 py-0.5 rounded-md border border-border backdrop-blur bg-material-medium',
    button: 'rounded-md',
    indicator:
      'bg-background-secondary rounded-md border border-border/80 shadow-sm',
  },
} as const

export function SegmentTab<T = string>({
  items,
  value,
  onChange,
  className,
  containerClassName,
  activeClassName,
  inactiveClassName,
  size = 'md',
  variant = 'default',
  disabled = false,
  responsiveWrap = false,
  ref,
}: SegmentTabProps<T>) {
  const id = useId()
  const styles = variantClasses[variant]
  const sizeClass = sizeClasses[variant][size]
  return (
    <div
      ref={ref}
      role="tablist"
      aria-disabled={disabled || undefined}
      className={cn(
        'relative flex items-center container-type-[inline-size] w-full',
        styles.container,
        disabled && 'opacity-60 pointer-events-none',
        containerClassName,
      )}
    >
      <div
        className={cn(
          'relative flex items-center w-full',
          responsiveWrap && 'flex-wrap',
        )}
      >
        {/* 标签按钮 */}
        {items.map((item) => {
          const isActive = item.value === value

          return (
            <m.button
              key={String(item.value)}
              type="button"
              onClick={() => !disabled && onChange(item.value)}
              className={cn(
                // Text legibility and pill shape
                'relative font-medium transition-colors duration-200',
                'flex items-center justify-center gap-2 py-1 whitespace-nowrap',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
                sizeClass,
                styles.button,
                responsiveWrap
                  ? clsx(
                      '@[0px]:basis-[calc(50%-0.125rem)] @[0px]:flex-none @[0px]:px-2',
                      '@[420px]:basis-auto @[420px]:flex-1 @[420px]:px-3',
                    )
                  : clsx('flex-1', '@[0px]:px-2 @[420px]:px-3'),
                isActive
                  ? cn('text-text', activeClassName)
                  : cn(
                      'text-text-secondary hover:text-text',
                      inactiveClassName,
                    ),
              )}
              style={{ zIndex: 2 }}
              disabled={disabled}
              role="tab"
              aria-selected={isActive}
              whileTap={{ scale: 0.985 }}
            >
              {item.icon && (
                <span className="flex items-center justify-center">
                  {item.icon}
                </span>
              )}
              <span
                className={cn(
                  !responsiveWrap && '@[0px]:hidden @[420px]:inline',
                )}
              >
                {item.label}
              </span>

              {isActive && (
                <m.div
                  key={`${id}-${String(item.value)}`}
                  layoutId={`${id}-segment-tab-indicator`}
                  className={cn(
                    // Floating pill indicator with subtle border & shadow
                    'absolute inset-x-0 inset-y-0.5 pointer-events-none z-[-1]',
                    styles.indicator,
                    responsiveWrap && 'hidden @[420px]:block',
                    className,
                  )}
                />
              )}
            </m.button>
          )
        })}
      </div>
    </div>
  )
}
