import { useVirtualizer } from '@tanstack/react-virtual'
import { useAtomValue } from 'jotai'
import * as React from 'react'

import { cn } from '~/lib/cn'
import { useTorrentDataStore } from '~/modules/torrent/stores'
import { selectTorrentsLength } from '~/modules/torrent/stores/torrent-selectors'

import { mobileCellConfigAtom } from '../atoms/mobile-layout'
import { MOBILE_LAYOUT_CONSTANTS } from '../constants'
import { MobileTorrentCardConfigurable } from './MobileTorrentCardConfigurable'

interface MobileTorrentListProps {
  className?: string
  onCellTap?: (torrentHash: string) => void
}

export const MobileTorrentList = ({
  className,
  onCellTap,
}: MobileTorrentListProps = {}) => {
  const torrentsLength = useTorrentDataStore(selectTorrentsLength)

  // Empty state - iOS style
  if (torrentsLength === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background p-8">
        <div className="text-center text-text-secondary max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-background-secondary flex items-center justify-center">
            <i className="i-mingcute-folder-open-line text-2xl text-text-tertiary" />
          </div>
          <p className="text-lg font-medium text-text mb-2">No Torrents</p>
          <p className="text-sm text-text-secondary leading-relaxed">
            Add your first torrent by tapping the + button or dragging files
            here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex-1 bg-background', className)}>
      <VirtualizedTorrentList onCellTap={onCellTap} />
    </div>
  )
}

interface VirtualizedTorrentListProps {
  onCellTap?: (torrentHash: string) => void
}

const VirtualizedTorrentList = ({ onCellTap }: VirtualizedTorrentListProps) => {
  const torrentsLength = useTorrentDataStore(selectTorrentsLength)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const cellConfig = useAtomValue(mobileCellConfigAtom)

  // Cache for measured heights to avoid remeasuring
  const measuredHeights = React.useRef<Map<number, number>>(new Map())

  // Smart height estimation based on cell configuration
  const getEstimatedHeight = React.useCallback(() => {
    let estimatedHeight = MOBILE_LAYOUT_CONSTANTS.CELL_HEIGHT

    // Count visible secondary fields
    const secondaryFieldsCount = cellConfig.fields.filter(
      (f) => f.secondary && f.visible,
    ).length

    // Add height for each secondary field line
    if (secondaryFieldsCount > 0) {
      // Each secondary field adds approximately 16px (text + spacing)
      estimatedHeight += Math.ceil(secondaryFieldsCount / 3) * 16 // Assume 3 fields per line
    }

    // Add height for progress bar if enabled
    if (cellConfig.showProgress) {
      estimatedHeight += 8 // Progress bar + margin
    }

    // Add buffer for padding and potential text wrapping
    estimatedHeight += 8

    return Math.max(estimatedHeight, MOBILE_LAYOUT_CONSTANTS.CELL_HEIGHT)
  }, [cellConfig])

  // Estimate size based on content and configuration
  const estimateSize = React.useCallback(
    (index: number) => {
      // Check if we have a measured height for this index
      const cachedHeight = measuredHeights.current.get(index)
      if (cachedHeight) {
        return cachedHeight
      }

      return getEstimatedHeight()
    },
    [getEstimatedHeight],
  )

  // Measure element function for dynamic height adjustment
  const measureElement = React.useCallback((element: Element | null) => {
    if (!element) {
      return MOBILE_LAYOUT_CONSTANTS.CELL_HEIGHT
    }

    // Get the element's actual rendered height
    const rect = element.getBoundingClientRect()
    const measuredHeight = Math.max(
      rect.height,
      MOBILE_LAYOUT_CONSTANTS.CELL_HEIGHT,
    )

    // Extract index from data attribute if available (cast to HTMLElement for dataset access)
    const htmlElement = element as HTMLElement
    const indexAttr = htmlElement.dataset.index
    if (indexAttr !== undefined) {
      const index = Number.parseInt(indexAttr, 10)
      if (!Number.isNaN(index)) {
        measuredHeights.current.set(index, measuredHeight)
      }
    }

    return measuredHeight
  }, [])

  // Initialize virtualizer with measurement capabilities
  const virtualizer = useVirtualizer({
    count: torrentsLength,
    getScrollElement: () => containerRef.current,
    estimateSize,
    measureElement,
    overscan: 10, // Render extra items for smooth scrolling
    // Enable measurement for dynamic content
    getItemKey: React.useCallback((index: number) => `torrent-${index}`, []),
  })

  const items = virtualizer.getVirtualItems()

  // Clear height cache when torrent count or cell configuration changes
  React.useEffect(() => {
    measuredHeights.current.clear()
  }, [torrentsLength, cellConfig])
  return (
    <div
      ref={containerRef}
      className="flex flex-1 relative h-[calc(100vh-5rem)] overflow-y-auto"
      style={{
        WebkitOverflowScrolling: 'touch', // iOS smooth scrolling
      }}
      data-mobile-torrent-list
    >
      {/* iOS-style table view */}
      <div
        className="relative w-full flex-1"
        style={{
          height: virtualizer.getTotalSize(),
          contain: 'strict', // Performance optimization for virtualization
        }}
      >
        {items.map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index} // For measureElement to identify items
            ref={virtualizer.measureElement} // Connect to virtualizer measurement
            className="absolute top-0 left-0 w-full"
            style={{
              height: virtualItem.size,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <MobileTorrentCardConfigurable
              rowIndex={virtualItem.index}
              onTap={onCellTap}
            />
          </div>
        ))}
      </div>

      {/* Pull to refresh indicator area */}
      <div className="h-4" />
    </div>
  )
}
