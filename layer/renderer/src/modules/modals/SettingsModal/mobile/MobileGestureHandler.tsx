import type { PanInfo } from 'motion/react'
import { m, useAnimation } from 'motion/react'
import * as React from 'react'
import { useCallback, useRef, useState } from 'react'

import { cn } from '~/lib/cn'

import {
  useMobileNavigationSelectors,
  useMobileNavigationStore,
} from './mobile-navigation-store'

interface MobileGestureHandlerProps {
  children: React.ReactNode
  className?: string
  disabled?: boolean
  swipeThreshold?: number
  onSwipeBack?: () => boolean // Return true if swipe was handled
}

export const MobileGestureHandler: React.FC<MobileGestureHandlerProps> = ({
  children,
  className,
  disabled = false,
  swipeThreshold = 100,
  onSwipeBack,
}) => {
  const canGoBack = useMobileNavigationSelectors.useCanGoBack()
  const isNavigating = useMobileNavigationSelectors.useIsNavigating()
  const pop = useMobileNavigationStore((state) => state.pop)

  const controls = useAnimation()
  const [isDragging, setIsDragging] = useState(false)
  const [dragProgress, setDragProgress] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Check if gesture should be enabled
  const isGestureEnabled = !disabled && canGoBack && !isNavigating

  // Handle drag start
  const handleDragStart = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!isGestureEnabled) return

      // Only allow swipe from left edge (first 20px of screen)
      const startX = info.point.x
      const screenWidth = window.innerWidth
      const edgeThreshold = Math.min(20, screenWidth * 0.05)

      if (startX > edgeThreshold) {
        return
      }

      setIsDragging(true)
      setDragProgress(0)
    },
    [isGestureEnabled],
  )

  // Handle drag motion
  const handleDrag = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!isDragging || !isGestureEnabled) return

      const deltaX = info.offset.x
      const screenWidth = window.innerWidth
      const progress = Math.max(0, Math.min(1, deltaX / screenWidth))

      setDragProgress(progress)

      // Apply real-time transform during drag
      controls.start({
        x: Math.max(deltaX, 0),
        transition: { type: 'spring', damping: 30, stiffness: 300 },
      })
    },
    [isDragging, isGestureEnabled, controls],
  )

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!isDragging || !isGestureEnabled) {
        setIsDragging(false)
        setDragProgress(0)
        return
      }

      const deltaX = info.offset.x
      const velocityX = info.velocity.x

      // Determine if swipe should trigger navigation
      const shouldNavigate =
        deltaX > swipeThreshold || (deltaX > 50 && velocityX > 300)

      setIsDragging(false)
      setDragProgress(0)

      if (shouldNavigate) {
        // Animate to complete the swipe
        controls
          .start({
            x: window.innerWidth,
            transition: { type: 'spring', damping: 25, stiffness: 200 },
          })
          .then(() => {
            // Trigger navigation after animation
            if (onSwipeBack) {
              const handled = onSwipeBack()
              if (!handled) {
                pop()
              }
            } else {
              pop()
            }

            // Reset position
            controls.set({ x: 0 })
          })
      } else {
        // Animate back to original position
        controls.start({
          x: 0,
          transition: { type: 'spring', damping: 25, stiffness: 300 },
        })
      }
    },
    [isDragging, isGestureEnabled, swipeThreshold, controls, onSwipeBack, pop],
  )

  // Handle touch events for better mobile support
  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!isGestureEnabled) return

      const touch = event.touches[0]
      const info: PanInfo = {
        point: { x: touch.clientX, y: touch.clientY },
        delta: { x: 0, y: 0 },
        offset: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
      }

      handleDragStart(event.nativeEvent, info)
    },
    [handleDragStart, isGestureEnabled],
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-full w-full',
        isDragging && 'select-none',
        className,
      )}
      onTouchStart={handleTouchStart}
    >
      <m.div
        className="h-full w-full"
        animate={controls}
        drag={isGestureEnabled ? 'x' : false}
        dragConstraints={{ left: 0, right: window.innerWidth }}
        dragElastic={0.2}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{
          touchAction: isGestureEnabled ? 'pan-y' : 'auto',
        }}
      >
        {children}
      </m.div>

      {/* Gesture indicator when dragging */}
      {isDragging && dragProgress > 0 && (
        <m.div
          className="absolute left-0 top-0 bottom-0 w-1 bg-accent/50 origin-top"
          initial={{ scaleY: 0 }}
          animate={{
            scaleY: dragProgress,
            opacity: dragProgress > 0.3 ? 1 : 0.6,
          }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        />
      )}

      {/* Background overlay during drag */}
      {isDragging && dragProgress > 0.1 && (
        <m.div
          className="absolute inset-0 bg-black pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{
            opacity: dragProgress * 0.2,
          }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        />
      )}
    </div>
  )
}

// Hook for programmatic gesture handling
export const useMobileGesture = () => {
  const canGoBack = useMobileNavigationSelectors.useCanGoBack()
  const isNavigating = useMobileNavigationSelectors.useIsNavigating()
  const pop = useMobileNavigationStore((state) => state.pop)

  const triggerSwipeBack = useCallback(() => {
    if (canGoBack && !isNavigating) {
      return pop()
    }
    return false
  }, [canGoBack, isNavigating, pop])

  return {
    canGoBack,
    isNavigating,
    triggerSwipeBack,
  }
}
