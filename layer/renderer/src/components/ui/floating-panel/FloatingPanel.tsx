import { m } from 'motion/react'
import type { ReactNode } from 'react'

import { cn } from '~/lib/cn'
import { Spring } from '~/lib/spring'

import { FloatingResizeHandles } from '../resizer/FloatingResizeHandles'

interface FloatingPanelProps {
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  height: number
  icon?: ReactNode
  maxHeight?: number
  maxWidth?: number
  minHeight?: number
  minWidth?: number
  offset?: number
  onHeightChange: (height: number) => void
  onWidthChange: (width: number) => void
  title: string
  width: number
  zIndex?: number
}

export const FloatingPanel = ({
  actions,
  children,
  className,
  contentClassName,
  height,
  icon,
  maxHeight = 800,
  maxWidth = 800,
  minHeight = 300,
  minWidth = 280,
  offset = 16,
  title,
  width,
  zIndex = 50,
  onHeightChange,
  onWidthChange,
}: FloatingPanelProps) => (
  <div className="relative">
    <m.aside
      animate={{ opacity: 1, scale: 1, y: 0 }}
      aria-label={title}
      exit={{ opacity: 0, scale: 0.6, y: 20 }}
      initial={{ opacity: 0, scale: 0.6, y: 20 }}
      transition={Spring.presets.smooth}
      className={cn(
        'relative flex origin-bottom-right flex-col rounded-lg border border-border bg-background shadow-2xl outline-1 outline-border backdrop-blur-sm container-type-[inline-size]',
        className,
      )}
      style={{
        position: 'fixed',
        bottom: offset,
        right: offset,
        width,
        height,
        zIndex,
      }}
    >
      <header className="flex h-[50px] shrink-0 items-center border-b border-border pl-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {icon}
          <h2 className="truncate font-medium text-text">{title}</h2>
        </div>
        <div className="flex items-center pr-2">{actions}</div>
      </header>
      <div className={cn('min-h-0 flex-1 overflow-auto', contentClassName)}>
        {children}
      </div>
    </m.aside>

    <FloatingResizeHandles
      height={height}
      maxHeight={maxHeight}
      maxWidth={maxWidth}
      minHeight={minHeight}
      minWidth={minWidth}
      offset={offset}
      width={width}
      zIndex={zIndex + 10}
      onHeightChange={onHeightChange}
      onWidthChange={onWidthChange}
      onCommit={({ width: nextWidth, height: nextHeight }) => {
        onWidthChange(nextWidth)
        onHeightChange(nextHeight)
      }}
    />
  </div>
)
