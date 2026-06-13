import type { Virtualizer } from '@tanstack/react-virtual'
import { useVirtualizer } from '@tanstack/react-virtual'
import * as React from 'react'

import { BASE_ROW_HEIGHT } from '../constants'
import { markTorrentTableScrollActive } from '../stores/torrent-table-performance'

type OffsetSubscriber = (offset: number, isScrolling: boolean) => void
type RectSubscriber = (rect: { width: number, height: number }) => void
type ScrollOffsetUpdater = number | ((current: number) => number)
type ScrollSamplingMode = 'default' | 'drag'

const DEFAULT_VIRTUALIZER_OFFSET_SAMPLE_SIZE = BASE_ROW_HEIGHT * 2
const DRAG_VIRTUALIZER_OFFSET_SAMPLE_SIZE = BASE_ROW_HEIGHT * 6
const DRAG_VIRTUALIZER_NOTIFY_INTERVAL_MS = 50
const DEFAULT_SCROLL_IDLE_RESET_MS = 220
const DRAG_SCROLL_IDLE_RESET_MS = 650

export interface TorrentTableVirtualizer {
  tableHeight: number
  headerHeight: number
  bodyHeight: number
  isScrolling: boolean
  totalSize: number
  maxScrollOffset: number
  getScrollOffset: () => number
  setBodyElement: (element: HTMLDivElement | null) => void
  setContainerElement: (element: HTMLDivElement | null) => void
  setScrollOffset: (
    nextOffset: ScrollOffsetUpdater,
    isScrolling?: boolean,
  ) => void
  setScrollSamplingMode: (mode: ScrollSamplingMode) => void
  handleWheel: (event: React.WheelEvent<HTMLDivElement>) => void
  handleKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const normalizeWheelDelta = (
  event: React.WheelEvent<HTMLDivElement>,
  pageSize: number,
) => {
  const multiplier
    = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? BASE_ROW_HEIGHT
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? pageSize
        : 1

  return event.deltaY * multiplier
}

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]'),
  )
}

export const useTorrentTableVirtualization = (
  torrentsLength: number,
): TorrentTableVirtualizer => {
  // Layout & container
  const containerRef = React.useRef<HTMLDivElement>(null)
  const bodyRef = React.useRef<HTMLDivElement>(null)
  const [tableHeight, setTableHeight] = React.useState(() => window.innerHeight)
  const [isScrollingState, setIsScrollingState] = React.useState(false)
  const [scrollSamplingModeState, setScrollSamplingModeState]
    = React.useState<ScrollSamplingMode>('default')
  const offsetRef = React.useRef(0)
  const isScrollingRef = React.useRef(false)
  const targetOffsetRef = React.useRef(0)
  const maxOffsetRef = React.useRef(0)
  const notifiedOffsetRef = React.useRef(0)
  const lastVirtualizerNotifyAtRef = React.useRef(0)
  const scrollFrameRef = React.useRef<number | null>(null)
  const offsetSubscribersRef = React.useRef(new Set<OffsetSubscriber>())
  const rectSubscribersRef = React.useRef(new Set<RectSubscriber>())
  const scrollEndTimerRef = React.useRef<number | null>(null)
  const scrollSamplingModeRef = React.useRef<ScrollSamplingMode>('default')

  const setContainerElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      containerRef.current = element
      if (element) {
        const maxOffset = maxOffsetRef.current
        const progress = maxOffset > 0 ? offsetRef.current / maxOffset : 0
        element.style.setProperty(
          '--torrent-table-scroll-progress',
          String(progress),
        )
      }
    },
    [],
  )

  const setBodyElement = React.useCallback((element: HTMLDivElement | null) => {
    bodyRef.current = element
    if (element) {
      element.style.setProperty(
        '--torrent-table-scroll-offset',
        `${offsetRef.current}px`,
      )
    }
  }, [])

  const syncBodyScrollCssVar = React.useCallback((offset: number) => {
    bodyRef.current?.style.setProperty(
      '--torrent-table-scroll-offset',
      `${offset}px`,
    )
  }, [])

  const syncScrollbarCssVar = React.useCallback((offset: number) => {
    const maxOffset = maxOffsetRef.current
    const progress = maxOffset > 0 ? offset / maxOffset : 0
    containerRef.current?.style.setProperty(
      '--torrent-table-scroll-progress',
      String(progress),
    )
  }, [])

  const syncScrollCssVars = React.useCallback(
    (offset: number) => {
      syncBodyScrollCssVar(offset)
      syncScrollbarCssVar(offset)
    },
    [syncBodyScrollCssVar, syncScrollbarCssVar],
  )

  // Measure container height
  const updateDimensions = React.useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const newHeight = Math.floor(rect.height) || 300
      setTableHeight(prev => (prev !== newHeight ? newHeight : prev))
    }
  }, [])

  React.useEffect(() => {
    if (!containerRef.current) {
      return
    }
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
  const notifyOffset = React.useCallback(
    (offset: number, isScrolling: boolean) => {
      notifiedOffsetRef.current = offset
      lastVirtualizerNotifyAtRef.current = performance.now()
      for (const subscriber of offsetSubscribersRef.current) {
        subscriber(offset, isScrolling)
      }
    },
    [],
  )

  const clearScrollEndTimer = React.useCallback(() => {
    if (!scrollEndTimerRef.current) {
      return
    }

    window.clearTimeout(scrollEndTimerRef.current)
    scrollEndTimerRef.current = null
  }, [])

  const markScrollEnd = React.useCallback(() => {
    clearScrollEndTimer()
    const resetDelay
      = scrollSamplingModeRef.current === 'drag'
        ? DRAG_SCROLL_IDLE_RESET_MS
        : DEFAULT_SCROLL_IDLE_RESET_MS

    scrollEndTimerRef.current = window.setTimeout(() => {
      scrollEndTimerRef.current = null
      isScrollingRef.current = false
      setIsScrollingState(false)
      syncBodyScrollCssVar(offsetRef.current)
      notifyOffset(offsetRef.current, false)
    }, resetDelay)
  }, [clearScrollEndTimer, notifyOffset, syncBodyScrollCssVar])

  const commitScrollOffset = React.useCallback(
    (next: number, isScrolling: boolean) => {
      if (next === offsetRef.current) {
        if (isScrolling) {
          markScrollEnd()
        }
        return
      }

      offsetRef.current = next
      if (isScrolling && !isScrollingRef.current) {
        isScrollingRef.current = true
        setIsScrollingState(true)
      }
      if (isScrolling) {
        markTorrentTableScrollActive()
      }

      const isDragSampling
        = isScrolling && scrollSamplingModeRef.current === 'drag'
      const now = performance.now()
      const shouldNotifyVirtualizer
        = !isScrolling
          || next === 0
          || next === maxOffsetRef.current
          || (Math.abs(next - notifiedOffsetRef.current)
            >= (isDragSampling
              ? DRAG_VIRTUALIZER_OFFSET_SAMPLE_SIZE
              : DEFAULT_VIRTUALIZER_OFFSET_SAMPLE_SIZE)
            && (!isDragSampling
              || now - lastVirtualizerNotifyAtRef.current
              >= DRAG_VIRTUALIZER_NOTIFY_INTERVAL_MS))

      syncScrollbarCssVar(next)

      if (!isDragSampling || shouldNotifyVirtualizer) {
        syncBodyScrollCssVar(next)
      }

      if (shouldNotifyVirtualizer) {
        notifyOffset(next, isScrolling)
      }

      if (isScrolling) {
        markScrollEnd()
      }
      else if (isScrollingRef.current) {
        isScrollingRef.current = false
        setIsScrollingState(false)
      }
    },
    [markScrollEnd, notifyOffset, syncBodyScrollCssVar, syncScrollbarCssVar],
  )

  const cancelPendingScrollFrame = React.useCallback(() => {
    if (scrollFrameRef.current === null) {
      return
    }

    window.cancelAnimationFrame(scrollFrameRef.current)
    scrollFrameRef.current = null
  }, [])

  const scheduleScrollCommit = React.useCallback(() => {
    if (scrollFrameRef.current !== null) {
      return
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null
      commitScrollOffset(targetOffsetRef.current, true)
    })
  }, [commitScrollOffset])

  const setScrollOffset = React.useCallback(
    (nextOffset: ScrollOffsetUpdater, isScrolling = true) => {
      const current = targetOffsetRef.current
      const rawNext
        = typeof nextOffset === 'function' ? nextOffset(current) : nextOffset
      const next = clamp(rawNext, 0, maxOffsetRef.current)

      if (next === targetOffsetRef.current && next === offsetRef.current) {
        if (isScrolling && scrollSamplingModeRef.current === 'drag') {
          syncBodyScrollCssVar(next)
          notifyOffset(next, true)
          markScrollEnd()
        }
        return
      }

      targetOffsetRef.current = next

      if (!isScrolling) {
        cancelPendingScrollFrame()
        clearScrollEndTimer()
        commitScrollOffset(next, false)
        return
      }

      scheduleScrollCommit()
    },
    [
      cancelPendingScrollFrame,
      clearScrollEndTimer,
      commitScrollOffset,
      markScrollEnd,
      notifyOffset,
      scheduleScrollCommit,
      syncBodyScrollCssVar,
    ],
  )

  React.useEffect(() => {
    return () => {
      cancelPendingScrollFrame()
      clearScrollEndTimer()
    }
  }, [cancelPendingScrollFrame, clearScrollEndTimer])

  const observeElementRect = React.useCallback(
    (_instance: Virtualizer<HTMLDivElement, Element>, cb: RectSubscriber) => {
      rectSubscribersRef.current.add(cb)
      cb({
        width: bodyRef.current?.offsetWidth ?? 0,
        height: bodyHeight,
      })

      return () => {
        rectSubscribersRef.current.delete(cb)
      }
    },
    [bodyHeight],
  )

  const observeElementOffset = React.useCallback(
    (_instance: Virtualizer<HTMLDivElement, Element>, cb: OffsetSubscriber) => {
      offsetSubscribersRef.current.add(cb)
      cb(offsetRef.current, false)

      return () => {
        offsetSubscribersRef.current.delete(cb)
      }
    },
    [],
  )

  React.useLayoutEffect(() => {
    const rect = {
      width: bodyRef.current?.offsetWidth ?? 0,
      height: bodyHeight,
    }

    for (const subscriber of rectSubscribersRef.current) {
      subscriber(rect)
    }
  }, [bodyHeight])

  const rowVirtualizer = useVirtualizer({
    count: torrentsLength,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => BASE_ROW_HEIGHT,
    observeElementRect,
    observeElementOffset,
    scrollToFn: (offset) => {
      setScrollOffset(offset)
    },
    overscan:
      scrollSamplingModeState === 'drag' ? 12 : isScrollingState ? 4 : 10,
  })

  const totalSize = rowVirtualizer.getTotalSize()
  const maxScrollOffset = Math.max(0, totalSize - bodyHeight)
  maxOffsetRef.current = maxScrollOffset

  React.useLayoutEffect(() => {
    if (offsetRef.current > maxScrollOffset) {
      setScrollOffset(maxScrollOffset, false)
    }
    else {
      syncScrollCssVars(offsetRef.current)
    }
  }, [maxScrollOffset, setScrollOffset, syncScrollCssVars])

  const getScrollOffset = React.useCallback(() => offsetRef.current, [])

  const setScrollSamplingMode = React.useCallback(
    (mode: ScrollSamplingMode) => {
      scrollSamplingModeRef.current = mode
      setScrollSamplingModeState(prev => (prev === mode ? prev : mode))
    },
    [],
  )

  const handleWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        return
      }

      const delta = normalizeWheelDelta(event, bodyHeight)
      if (delta === 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setScrollOffset(current => current + delta)
    },
    [bodyHeight, setScrollOffset],
  )

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditableTarget(event.target)) {
        return
      }

      let nextOffset: ScrollOffsetUpdater | null = null

      switch (event.key) {
        case 'ArrowDown': {
          nextOffset = current => current + BASE_ROW_HEIGHT
          break
        }
        case 'ArrowUp': {
          nextOffset = current => current - BASE_ROW_HEIGHT
          break
        }
        case 'PageDown': {
          nextOffset = current => current + bodyHeight
          break
        }
        case 'PageUp': {
          nextOffset = current => current - bodyHeight
          break
        }
        case 'Home': {
          nextOffset = 0
          break
        }
        case 'End': {
          nextOffset = maxOffsetRef.current
          break
        }
        default: {
          break
        }
      }

      if (nextOffset === null) {
        return
      }

      event.preventDefault()
      setScrollOffset(nextOffset)
    },
    [bodyHeight, setScrollOffset],
  )

  return {
    tableHeight,
    headerHeight,
    bodyHeight,
    isScrolling: isScrollingState,
    totalSize,
    maxScrollOffset,
    getScrollOffset,
    setBodyElement,
    setContainerElement,
    setScrollOffset,
    setScrollSamplingMode,
    handleWheel,
    handleKeyDown,
    rowVirtualizer,
  }
}
