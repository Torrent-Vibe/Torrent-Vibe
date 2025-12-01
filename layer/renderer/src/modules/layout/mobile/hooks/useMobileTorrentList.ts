import { useVirtualizer } from '@tanstack/react-virtual'
import { useAtomValue } from 'jotai'
import * as React from 'react'

import { useTorrentDataStore } from '~/modules/torrent/stores'
import { selectTorrentsLength } from '~/modules/torrent/stores/torrent-selectors'

import { expandedCardsAtom } from '../atoms/mobile-layout'
import { MOBILE_LAYOUT_CONSTANTS } from '../constants'

// Mobile-specific list management
export const useMobileTorrentList = () => {
  const torrentsLength = useTorrentDataStore(selectTorrentsLength)

  const expandedCards = useAtomValue(expandedCardsAtom)

  // Refs for virtualization
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = React.useState(
    () => window.innerHeight - 120,
  )

  // Get torrent hash for expanded state calculation
  const getTorrentHash = React.useCallback((index: number) => {
    const { sortedTorrents } = useTorrentDataStore.getState()
    return sortedTorrents[index]?.hash || ''
  }, [])

  // Measure container height for proper virtualization
  const updateDimensions = React.useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const newHeight = Math.floor(rect.height) || 400
      setContainerHeight((prev) => (prev !== newHeight ? newHeight : prev))
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

  // Virtualization with dynamic sizing based on expanded state
  const virtualizer = useVirtualizer({
    count: torrentsLength,
    getScrollElement: () => containerRef.current,
    estimateSize: React.useCallback(
      (index) => {
        const torrentHash = getTorrentHash(index)
        const isExpanded = expandedCards.has(torrentHash)
        return isExpanded
          ? MOBILE_LAYOUT_CONSTANTS.CELL_HEIGHT_EXPANDED
          : MOBILE_LAYOUT_CONSTANTS.CELL_HEIGHT
      },
      [expandedCards, getTorrentHash],
    ),
    measureElement: (el) => {
      // Include margin in measurement
      if (!el) return MOBILE_LAYOUT_CONSTANTS.CELL_HEIGHT
      const rect = el.getBoundingClientRect()
      return rect.height + 12 // 12px gap (mb-3)
    },
    overscan: 5, // Reduced overscan for mobile performance
    scrollMargin: containerHeight * 0.1, // 10% buffer for smooth scrolling
  })

  // Scroll utilities
  const scrollToTop = React.useCallback(() => {
    virtualizer.scrollToIndex(0, { align: 'start', behavior: 'smooth' })
  }, [virtualizer])

  const scrollToIndex = React.useCallback(
    (index: number) => {
      virtualizer.scrollToIndex(index, { align: 'center', behavior: 'smooth' })
    },
    [virtualizer],
  )

  const scrollToTorrent = React.useCallback(
    (torrentHash: string) => {
      const { sortedTorrents } = useTorrentDataStore.getState()
      const index = sortedTorrents.findIndex((t) => t.hash === torrentHash)
      if (index !== -1) {
        scrollToIndex(index)
      }
    },
    [scrollToIndex],
  )

  // List state
  const items = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  // Performance monitoring
  const listMetrics = React.useMemo(() => {
    const expandedCount = expandedCards.size
    const collapsedCount = Math.max(0, torrentsLength - expandedCount)
    const estimatedHeight =
      expandedCount * MOBILE_LAYOUT_CONSTANTS.CELL_HEIGHT_EXPANDED +
      collapsedCount * MOBILE_LAYOUT_CONSTANTS.CELL_HEIGHT

    return {
      totalItems: torrentsLength,
      expandedCount,
      collapsedCount,
      estimatedHeight,
      actualHeight: totalSize,
      visibleItems: items.length,
      containerHeight,
    }
  }, [
    torrentsLength,
    expandedCards.size,
    totalSize,
    items.length,
    containerHeight,
  ])

  return {
    // Virtualization
    containerRef,
    virtualizer,
    items,
    totalSize,
    containerHeight,

    // Data state
    torrentsLength,

    expandedCards,

    // Actions
    scrollToTop,
    scrollToIndex,
    scrollToTorrent,
    getTorrentHash,

    // Metrics
    listMetrics,

    // State checks
    isEmpty: torrentsLength === 0,
    hasData: torrentsLength > 0,
  }
}

// Hook for mobile list performance optimization
export const useMobileListPerformance = () => {
  const [isScrolling, setIsScrolling] = React.useState(false)
  const [scrollPosition, setScrollPosition] = React.useState(0)
  const scrollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const handleScroll = React.useCallback((scrollTop: number) => {
    setScrollPosition(scrollTop)
    setIsScrolling(true)

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    // Set new timeout to detect when scrolling stops
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false)
    }, 150)
  }, [])

  React.useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  return {
    isScrolling,
    scrollPosition,
    handleScroll,

    // Performance flags
    shouldReduceAnimations: isScrolling,
    shouldUseReducedMotion: isScrolling,
  }
}

// Hook for mobile pull-to-refresh functionality
export const useMobilePullToRefresh = (
  onRefresh?: () => Promise<void> | void,
) => {
  const [isPulling, setIsPulling] = React.useState(false)
  const [pullDistance, setPullDistance] = React.useState(0)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  const PULL_THRESHOLD = 100
  const MAX_PULL_DISTANCE = 150

  const handlePullStart = React.useCallback(() => {
    setIsPulling(true)
    setPullDistance(0)
  }, [])

  const handlePullMove = React.useCallback(
    (distance: number) => {
      if (!isPulling) return

      // Apply elastic resistance
      const elasticDistance = Math.min(
        distance * 0.4, // Resistance factor
        MAX_PULL_DISTANCE,
      )

      setPullDistance(elasticDistance)
    },
    [isPulling],
  )

  const handlePullEnd = React.useCallback(async () => {
    if (!isPulling) return

    setIsPulling(false)

    if (pullDistance >= PULL_THRESHOLD && onRefresh && !isRefreshing) {
      setIsRefreshing(true)
      try {
        await onRefresh()
      } catch (error) {
        console.error('Refresh failed:', error)
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [isPulling, pullDistance, onRefresh, isRefreshing])

  const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1)
  const shouldTriggerRefresh = pullDistance >= PULL_THRESHOLD

  return {
    isPulling,
    pullDistance,
    pullProgress,
    isRefreshing,
    shouldTriggerRefresh,
    handlePullStart,
    handlePullMove,
    handlePullEnd,

    // UI helpers
    pullIndicatorOpacity: Math.min(pullProgress * 2, 1),
    pullIndicatorRotation: pullProgress * 180,
    pullText: shouldTriggerRefresh ? 'Release to refresh' : 'Pull to refresh',
  }
}

// Hook for mobile list keyboard navigation (accessibility)
export const useMobileListKeyboard = (
  virtualizer: ReturnType<typeof useVirtualizer>,
  options: {
    onSelect?: (index: number) => void
    onAction?: (index: number) => void
  } = {},
) => {
  const { onSelect, onAction } = options
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1)
  const torrentsLength = useTorrentDataStore(selectTorrentsLength)

  const handleKeyDown = React.useCallback(
    (event: KeyboardEvent) => {
      if (torrentsLength === 0) return

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault()
          setFocusedIndex((prev) => {
            const next = Math.min(prev + 1, torrentsLength - 1)
            virtualizer.scrollToIndex(next, { align: 'center' })
            return next
          })
          break
        }

        case 'ArrowUp': {
          event.preventDefault()
          setFocusedIndex((prev) => {
            const next = Math.max(prev - 1, 0)
            virtualizer.scrollToIndex(next, { align: 'center' })
            return next
          })
          break
        }

        case 'Enter':
        case ' ': {
          event.preventDefault()
          if (focusedIndex >= 0) {
            if (event.key === 'Enter' && onAction) {
              onAction(focusedIndex)
            } else if (event.key === ' ' && onSelect) {
              onSelect(focusedIndex)
            }
          }
          break
        }

        case 'Home': {
          event.preventDefault()
          setFocusedIndex(0)
          virtualizer.scrollToIndex(0, { align: 'start' })
          break
        }

        case 'End': {
          event.preventDefault()
          setFocusedIndex(torrentsLength - 1)
          virtualizer.scrollToIndex(torrentsLength - 1, { align: 'end' })
          break
        }
      }
    },
    [focusedIndex, torrentsLength, virtualizer, onSelect, onAction],
  )

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    focusedIndex,
    setFocusedIndex,
    isFocused: (index: number) => index === focusedIndex,
  }
}
