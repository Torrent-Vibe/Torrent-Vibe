import type { Virtualizer } from '@tanstack/react-virtual'
import { useVirtualizer } from '@tanstack/react-virtual'
import * as React from 'react'

import { BASE_ROW_HEIGHT } from '../constants'

export interface TorrentTableVirtualizer {
  containerRef: React.RefObject<HTMLDivElement | null>
  bodyRef: React.RefObject<HTMLDivElement | null>
  tableHeight: number
  headerHeight: number
  bodyHeight: number
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>
}
export const useTorrentTableVirtualization = (
  torrentsLength: number,
): TorrentTableVirtualizer => {
  // Layout & container
  const containerRef = React.useRef<HTMLDivElement>(null)
  const bodyRef = React.useRef<HTMLDivElement>(null)
  const [tableHeight, setTableHeight] = React.useState(() => window.innerHeight)

  // Measure container height
  const updateDimensions = React.useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const newHeight = Math.floor(rect.height) || 300
      setTableHeight((prev) => (prev !== newHeight ? newHeight : prev))
    }
  }, [])

  React.useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(containerRef.current)
    updateDimensions()
    return () => resizeObserver.disconnect()
  }, [updateDimensions])

  React.useEffect(() => {
    const onResize = () => updateDimensions()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [updateDimensions])

  // Virtualization
  const headerHeight = 48
  const bodyHeight = Math.max(0, tableHeight - headerHeight)
  const rowVirtualizer = useVirtualizer({
    count: torrentsLength,
    getScrollElement: () => bodyRef.current || containerRef.current,
    estimateSize: () => BASE_ROW_HEIGHT,
    measureElement: (el) =>
      el ? el.getBoundingClientRect().height : BASE_ROW_HEIGHT,
    overscan: 8,
  })

  return {
    containerRef,
    bodyRef,
    tableHeight,
    headerHeight,
    bodyHeight,
    rowVirtualizer,
  }
}
