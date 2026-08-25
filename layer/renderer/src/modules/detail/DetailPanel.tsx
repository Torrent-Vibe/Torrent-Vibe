import * as React from 'react'

import { Button } from '~/components/ui/button/Button'
import { FloatingPanel } from '~/components/ui/floating-panel/FloatingPanel'
import { cn } from '~/lib/cn'
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
      style={style}
      className={cn(
        'bg-background border-border flex flex-col  container-type-[inline-size]',
        className,
      )}
    >
      <div className="flex items-center justify-between pl-4 border-b border-l border-border h-[51px]">
        <h2 className="font-medium text-text">Details</h2>
        <div className="flex items-center pr-2">
          <Button
            className="!p-2"
            title="Float panel"
            variant="ghost"
            onClick={() => setFloating(true)}
          >
            <i className="i-lucide-maximize text-lg" />
          </Button>
          <Button
            className="!p-2"
            variant="ghost"
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

  return (
    <FloatingPanel
      className={className}
      height={floatingHeight}
      title="Details"
      width={floatingWidth}
      actions={
        <>
          <Button
            className="!p-2"
            title="Dock panel"
            variant="ghost"
            onClick={() => setFloating(false)}
          >
            <i className="i-lucide-panel-right text-lg" />
          </Button>
          <Button
            className="!p-2"
            variant="ghost"
            onClick={() => setVisible(false)}
          >
            <i className="i-mingcute-close-line text-lg" />
          </Button>
        </>
      }
      onHeightChange={setFloatingHeight}
      onWidthChange={setFloatingWidth}
    >
      {children}
    </FloatingPanel>
  )
}
