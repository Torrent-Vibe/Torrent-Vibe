import type { PanInfo } from 'motion/react'
import { useCallback } from 'react'

// Gesture configuration constants
const SWIPE_THRESHOLD = 100 // Minimum distance for swipe detection
const LONG_PRESS_DURATION = 500 // Duration in ms for long press
const TAP_MAX_DURATION = 200 // Maximum duration for tap vs long press

interface MobileGestureOptions {
  onTap?: (data: { target: HTMLElement; timestamp: number }) => void
  onLongPress?: (data: { target: HTMLElement; timestamp: number }) => void
  onSwipeLeft?: (data: { target: HTMLElement; distance: number }) => void
  onSwipeRight?: (data: { target: HTMLElement; distance: number }) => void
  onSwipeUp?: (data: { target: HTMLElement; distance: number }) => void
  onSwipeDown?: (data: { target: HTMLElement; distance: number }) => void

  // Gesture thresholds (optional overrides)
  swipeThreshold?: number
  longPressDuration?: number
  tapMaxDuration?: number

  // Disable specific gestures
  disableTap?: boolean
  disableLongPress?: boolean
  disableSwipe?: boolean
}

export const useMobileGestures = (options: MobileGestureOptions = {}) => {
  const {
    onTap,
    onLongPress,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    swipeThreshold = SWIPE_THRESHOLD,
    longPressDuration = LONG_PRESS_DURATION,
    tapMaxDuration = TAP_MAX_DURATION,
    disableTap = false,
    disableLongPress = false,
    disableSwipe = false,
  } = options

  // Track gesture state
  let gestureStartTime = 0
  let longPressTimer: NodeJS.Timeout | null = null
  let isLongPressed = false

  // Handle tap start (mouse down / touch start)
  const handleTapStart = useCallback(
    (event: React.PointerEvent | React.MouseEvent) => {
      gestureStartTime = Date.now()
      isLongPressed = false

      // Clear any existing long press timer
      if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }

      // Set up long press detection if enabled
      if (!disableLongPress && onLongPress) {
        longPressTimer = setTimeout(() => {
          isLongPressed = true
          onLongPress({
            target: event.currentTarget as HTMLElement,
            timestamp: Date.now(),
          })
        }, longPressDuration)
      }
    },
    [disableLongPress, onLongPress, longPressDuration],
  )

  // Handle tap end (mouse up / touch end)
  const handleTapEnd = useCallback(
    (event: React.PointerEvent | React.MouseEvent) => {
      const gestureDuration = Date.now() - gestureStartTime

      // Clear long press timer
      if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }

      // Only trigger tap if it wasn't a long press and within tap duration
      if (
        !disableTap &&
        !isLongPressed &&
        gestureDuration <= tapMaxDuration &&
        onTap
      ) {
        onTap({
          target: event.currentTarget as HTMLElement,
          timestamp: Date.now(),
        })
      }

      // Reset state
      gestureStartTime = 0
      isLongPressed = false
    },
    [disableTap, onTap, tapMaxDuration],
  )

  // Handle pan/swipe gestures
  const handlePan = useCallback(
    (event: Event, info: PanInfo) => {
      if (disableSwipe) return

      const { offset } = info
      const absX = Math.abs(offset.x)
      const absY = Math.abs(offset.y)

      // Determine if this is a significant swipe
      const isSignificantSwipe = Math.max(absX, absY) > swipeThreshold

      if (!isSignificantSwipe) return

      // Determine swipe direction
      if (absX > absY) {
        // Horizontal swipe
        if (offset.x > 0 && onSwipeRight) {
          onSwipeRight({
            target: event.target as HTMLElement,
            distance: offset.x,
          })
        } else if (offset.x < 0 && onSwipeLeft) {
          onSwipeLeft({
            target: event.target as HTMLElement,
            distance: Math.abs(offset.x),
          })
        }
      } else {
        // Vertical swipe
        if (offset.y > 0 && onSwipeDown) {
          onSwipeDown({
            target: event.target as HTMLElement,
            distance: offset.y,
          })
        } else if (offset.y < 0 && onSwipeUp) {
          onSwipeUp({
            target: event.target as HTMLElement,
            distance: Math.abs(offset.y),
          })
        }
      }
    },
    [
      disableSwipe,
      swipeThreshold,
      onSwipeLeft,
      onSwipeRight,
      onSwipeUp,
      onSwipeDown,
    ],
  )

  // Cancel gesture on pointer leave/cancel
  const handlePointerCancel = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
    gestureStartTime = 0
    isLongPressed = false
  }, [])

  // Return gesture handlers for Framer Motion
  const motionGestureHandlers = {
    onTapStart: handleTapStart,
    onTap: handleTapEnd,
    onPan: handlePan,
    onPointerCancel: handlePointerCancel,
    onPointerLeave: handlePointerCancel,
  }

  // Return gesture handlers for standard DOM events
  const domGestureHandlers = {
    onPointerDown: handleTapStart,
    onPointerUp: handleTapEnd,
    onPointerCancel: handlePointerCancel,
    onPointerLeave: handlePointerCancel,
  }

  return {
    motionGestureHandlers,
    domGestureHandlers,
    // Individual handlers for custom usage
    handleTapStart,
    handleTapEnd,
    handlePan,
    handlePointerCancel,
  }
}

// Specialized hook for torrent card gestures
export const useTorrentCardGestures = (
  torrentHash: string,
  options: {
    onCardTap?: (hash: string) => void
    onCardLongPress?: (hash: string) => void
    onCardSwipeLeft?: (hash: string) => void // For delete action
    onCardSwipeRight?: (hash: string) => void // For quick action (resume/pause)
  },
) => {
  const { onCardTap, onCardLongPress, onCardSwipeLeft, onCardSwipeRight } =
    options

  const gestureHandlers = useMobileGestures({
    onTap: () => onCardTap?.(torrentHash),
    onLongPress: () => onCardLongPress?.(torrentHash),
    onSwipeLeft: () => onCardSwipeLeft?.(torrentHash),
    onSwipeRight: () => onCardSwipeRight?.(torrentHash),
    // Disable vertical swipes for cards
    disableSwipe: false,
  })

  return gestureHandlers
}

// Hook for handling mobile list gestures (pull to refresh, etc.)
export const useMobileListGestures = (options: {
  onPullToRefresh?: () => void
  pullThreshold?: number
}) => {
  const { onPullToRefresh, pullThreshold = 120 } = options

  const listGestureHandlers = useMobileGestures({
    onSwipeDown: (data) => {
      // Check if we're at the top of the list
      const scrollElement = document.querySelector('[data-mobile-torrent-list]')
      if (
        scrollElement &&
        scrollElement.scrollTop <= 10 &&
        data.distance > pullThreshold &&
        onPullToRefresh
      ) {
        onPullToRefresh()
      }
    },
    swipeThreshold: pullThreshold,
    disableTap: true, // Lists don't need tap handling
    disableLongPress: true, // Lists don't need long press
  })

  return listGestureHandlers
}

// Utility functions for gesture detection
export const gestureUtils = {
  isTouchDevice: () => {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-ignore
      navigator.msMaxTouchPoints > 0
    )
  },

  getGestureEventPosition: (event: TouchEvent | MouseEvent | PointerEvent) => {
    if ('touches' in event && event.touches.length > 0) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY }
    } else {
      return {
        x: (event as MouseEvent).clientX,
        y: (event as MouseEvent).clientY,
      }
    }
  },

  preventBrowserDefaults: (element: HTMLElement) => {
    // Prevent iOS safari bounce
    element.style.overscrollBehavior = 'none'
    // element.style.webkitOverflowScrolling = "touch" // Not supported in TypeScript

    // Prevent context menu on long press
    element.addEventListener('contextmenu', (e) => {
      if (gestureUtils.isTouchDevice()) {
        e.preventDefault()
      }
    })

    // Prevent text selection during gestures
    element.style.userSelect = 'none'
    element.style.webkitUserSelect = 'none'
  },
}
