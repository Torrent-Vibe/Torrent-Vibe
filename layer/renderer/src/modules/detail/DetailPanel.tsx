import { m } from 'motion/react'
import * as React from 'react'

import { Button } from '~/components/ui/button/Button'
import { FloatingResizeHandles } from '~/components/ui/resizer/FloatingResizeHandles'
import { cn } from '~/lib/cn'
import { Spring } from '~/lib/spring'
import {
  useDetailPanelFloatingHeightValue,
  useDetailPanelFloatingWidthValue,
  useSetDetailPanelFloating,
  useSetDetailPanelFloatingHeight,
  useSetDetailPanelFloatingWidth,
  useSetDetailPanelVisible,
} from '~/modules/detail/atoms'

import type { DetailPanelProps } from '../layout/types'

// Fixed variant: used inside the resizable layout
export const DetailPanelFixed = ({
  className,
  children,
  style,
}: DetailPanelProps & { style?: React.CSSProperties }) => {
  const setVisible = useSetDetailPanelVisible()
  const setFloating = useSetDetailPanelFloating()

  return (
    <aside
      className={cn(
        'bg-background border-border flex flex-col  container-type-[inline-size]',
        className,
      )}
      style={style}
    >
      <div className="flex items-center justify-between pl-4 border-b border-l border-border h-[51px]">
        <h2 className="font-medium text-text">Details</h2>
        <div className="flex items-center pr-2">
          <Button
            className="!p-2"
            variant="ghost"
            onClick={() => setFloating(true)}
            title="Float panel"
          >
            <i className="i-lucide-maximize text-lg" />
          </Button>
          <Button
            variant="ghost"
            className="!p-2"
            onClick={() => setVisible(false)}
          >
            <i className="i-mingcute-close-line text-lg" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto border-l border-border">
        {children}
      </div>
    </aside>
  )
}

// Floating variant: free-floating panel with animated entrance and resize handles
export const DetailPanelFloat = ({ className, children }: DetailPanelProps) => {
  const setVisible = useSetDetailPanelVisible()
  const setFloating = useSetDetailPanelFloating()
  const floatingWidth = useDetailPanelFloatingWidthValue()
  const setFloatingWidth = useSetDetailPanelFloatingWidth()
  const floatingHeight = useDetailPanelFloatingHeightValue()
  const setFloatingHeight = useSetDetailPanelFloatingHeight()

  const floatingStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    width: `${floatingWidth}px`,
    height: `${floatingHeight}px`,
  }

  return (
    <div className={'relative'}>
      <m.aside
        className={cn(
          'bg-background relative border-border flex flex-col outline-1 outline-border container-type-[inline-size]',
          'rounded-lg shadow-2xl z-50 border backdrop-blur-sm',
          'origin-bottom-right',
          className,
        )}
        style={floatingStyle}
        initial={{ opacity: 0, scale: 0.6, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.6, y: 20 }}
        transition={Spring.presets.smooth}
      >
        <div className="flex items-center justify-between pl-4 border-b border-border h-[50px]">
          <h2 className="font-medium text-text">Details</h2>
          <div className="flex items-center pr-2">
            <Button
              className="!p-2"
              variant="ghost"
              onClick={() => setFloating(false)}
              title="Dock panel"
            >
              <i className="i-lucide-panel-right text-lg" />
            </Button>
            <Button
              variant="ghost"
              className="!p-2"
              onClick={() => setVisible(false)}
            >
              <i className="i-mingcute-close-line text-lg" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">{children}</div>
      </m.aside>

      <FloatingResizeHandles
        width={floatingWidth}
        height={floatingHeight}
        minWidth={280}
        maxWidth={800}
        minHeight={300}
        maxHeight={800}
        offset={16}
        onWidthChange={setFloatingWidth}
        onHeightChange={setFloatingHeight}
        onCommit={({ width, height }) => {
          setFloatingWidth(width)
          setFloatingHeight(height)
        }}
      />
    </div>
  )
}
