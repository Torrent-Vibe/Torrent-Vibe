import { useVirtualizer } from '@tanstack/react-virtual'
import type { ReactNode } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'

import { cn } from '~/lib/cn'

interface VirtualListProps<T> {
  className?: string
  data: T[]
  estimateSize?: number
  getItemKey: (item: T, index: number) => string | number
  itemClassName?: string
  overscan?: number
  renderItem: (item: T, index: number) => ReactNode
  scrollElement?: HTMLElement | null
}

export function VirtualList<T>({
  data,
  renderItem,
  getItemKey,
  estimateSize = 56,
  overscan = 8,
  scrollElement,
  className,
  itemClassName,
}: VirtualListProps<T>) {
  const internalScrollRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  const isExternal = scrollElement != null

  useLayoutEffect(() => {
    if (!isExternal || !scrollElement) {
      setScrollMargin(0)
      return
    }
    const measure = () => {
      const list = listRef.current
      if (!list) {
        return
      }
      setScrollMargin(
        list.getBoundingClientRect().top -
          scrollElement.getBoundingClientRect().top +
          scrollElement.scrollTop,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scrollElement)
    return () => observer.disconnect()
  }, [isExternal, scrollElement])

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () =>
      isExternal ? scrollElement : internalScrollRef.current,
    estimateSize: () => estimateSize,
    getItemKey: (index) => getItemKey(data[index], index),
    overscan,
    scrollMargin,
  })

  const sizer = (
    <div
      className="relative w-full"
      ref={listRef}
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => (
        <div
          className={cn('absolute left-0 top-0 w-full', itemClassName)}
          data-index={virtualItem.index}
          key={virtualItem.key}
          ref={virtualizer.measureElement}
          style={{
            transform: `translateY(${virtualItem.start - scrollMargin}px)`,
          }}
        >
          {renderItem(data[virtualItem.index], virtualItem.index)}
        </div>
      ))}
    </div>
  )

  if (isExternal) {
    return sizer
  }

  return (
    <div
      className={cn('h-full overflow-y-auto', className)}
      ref={internalScrollRef}
    >
      {sizer}
    </div>
  )
}
