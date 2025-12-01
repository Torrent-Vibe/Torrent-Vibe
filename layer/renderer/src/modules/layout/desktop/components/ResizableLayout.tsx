import * as React from 'react'
import { useEffect, useRef, useState } from 'react'

import { MainPanel } from './MainPanel'

export interface ResizablePanelRenderContext {
  width: number
  isDragging: boolean
}

export interface ResizablePanelConfig {
  isVisible: boolean
  width: number
  minWidth?: number
  maxWidth?: number
  onResizeStart?: () => void
  onResize?: (width: number) => void
  onResizeEnd?: (width: number) => void
  render: (context: ResizablePanelRenderContext) => React.ReactNode
}

export interface ResizableLayoutProps {
  mainContent: React.ReactNode
  className?: string
  resizablePanel?: ResizablePanelConfig
  rightRail?: React.ReactNode
}

export const ResizableLayout = ({
  mainContent,
  className = '',
  resizablePanel,
}: ResizableLayoutProps) => {
  const startDragPosition = React.useRef<number>(0)
  const styleElementRef = useRef<HTMLStyleElement>(null)
  const [position, setPosition] = useState(resizablePanel?.width ?? 0)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (typeof resizablePanel?.width === 'number') {
      setPosition(resizablePanel.width)
    }
  }, [resizablePanel?.width])

  useEffect(() => {
    return () => {
      styleElementRef.current?.remove()
      styleElementRef.current = null
    }
  }, [])

  const onSeparatorMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!resizablePanel?.isVisible) return

    event.preventDefault()
    event.stopPropagation()
    const $css = document.createElement('style')
    $css.innerHTML = `* { cursor: ew-resize !important; user-select: none !important; }`
    document.head.append($css)
    styleElementRef.current = $css
    setIsDragging(true)
    startDragPosition.current = position
    const startX = event.clientX
    const startWidth = position

    resizablePanel.onResizeStart?.()

    const minWidth = resizablePanel.minWidth ?? 280
    const maxWidth = resizablePanel.maxWidth ?? 600

    const onMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX
      const next = Math.min(Math.max(startWidth + deltaX, minWidth), maxWidth)
      setPosition(next)
      resizablePanel.onResize?.(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      styleElementRef.current?.remove()
      styleElementRef.current = null
      setIsDragging(false)
      if (position !== startDragPosition.current) {
        resizablePanel.onResizeEnd?.(position)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className={`flex flex-1 min-h-0 ${className}`}>
      {/* Main Panel - flexible width */}
      <MainPanel className="h-full overflow-y-auto">{mainContent}</MainPanel>

      {/* Resizer - only show in fixed mode */}
      {resizablePanel?.isVisible && (
        <div className="relative h-full w-0 shrink-0" data-hide-in-print>
          <div
            tabIndex={-1}
            className={`
              active:!bg-accent absolute inset-0 w-[2px] z-10 -translate-x-1/2 
              cursor-ew-resize bg-transparent hover:bg-gray-400 hover:dark:bg-neutral-500
              ${isDragging ? 'bg-accent' : ''}
            `}
            onMouseDown={onSeparatorMouseDown}
          />
        </div>
      )}

      {/* Resizable panel content */}
      {resizablePanel?.isVisible && (
        <div
          className="h-full shrink-0 overflow-hidden flex flex-col"
          style={{ width: position }}
        >
          <div className="relative flex flex-col flex-1">
            {resizablePanel.render({ width: position, isDragging })}
          </div>
        </div>
      )}
    </div>
  )
}
