import { AnimatePresence, m } from 'motion/react'
import { useCallback, useEffect } from 'react'

import { Spring } from '~/lib/spring'

import type { MobileNavigationScreen } from './mobile-navigation-store'
import {
  useMobileNavigationSelectors,
  useMobileNavigationStore,
} from './mobile-navigation-store'
import { MobileGestureHandler } from './MobileGestureHandler'

interface MobileStackNavigatorProps {
  children?: React.ReactNode
  className?: string
  renderScreen: (screen: MobileNavigationScreen) => React.ReactNode
  enableGestures?: boolean
  swipeThreshold?: number
}

export const MobileStackNavigator: React.FC<MobileStackNavigatorProps> = ({
  children,
  className = '',
  renderScreen,
  enableGestures = true,
  swipeThreshold = 100,
}) => {
  const currentScreen = useMobileNavigationSelectors.useCurrentScreen()
  const isNavigating = useMobileNavigationSelectors.useIsNavigating()
  const navigationDirection =
    useMobileNavigationSelectors.useNavigationDirection()
  const setIsNavigating = useMobileNavigationStore(
    (state) => state.setIsNavigating,
  )

  // Animation variants for screen transitions
  const getScreenVariants = useCallback((direction: 'push' | 'pop' | null) => {
    if (direction === 'push') {
      return {
        initial: { x: '100%', opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: '-30%', opacity: 0.8 },
      }
    } else if (direction === 'pop') {
      return {
        initial: { x: '-30%', opacity: 0.8 },
        animate: { x: 0, opacity: 1 },
        exit: { x: '100%', opacity: 0 },
      }
    }

    // Default/initial state
    return {
      initial: { x: 0, opacity: 1 },
      animate: { x: 0, opacity: 1 },
      exit: { x: 0, opacity: 0 },
    }
  }, [])

  // Handle animation completion
  const handleAnimationComplete = useCallback(() => {
    if (isNavigating) {
      setIsNavigating(false)
    }
  }, [isNavigating, setIsNavigating])

  // Cleanup effect for unmounting
  useEffect(() => {
    return () => {
      if (isNavigating) {
        setIsNavigating(false)
      }
    }
  }, [isNavigating, setIsNavigating])

  if (!currentScreen) {
    return (
      <div
        className={`h-full w-full flex items-center justify-center ${className}`}
      >
        {children || (
          <div className="text-text-secondary">
            No screens in navigation stack
          </div>
        )}
      </div>
    )
  }

  const variants = getScreenVariants(navigationDirection)

  return (
    <MobileGestureHandler
      className={className}
      disabled={!enableGestures}
      swipeThreshold={swipeThreshold}
    >
      <div className="relative h-full w-full overflow-hidden">
        <AnimatePresence
          mode="popLayout"
          onExitComplete={handleAnimationComplete}
        >
          <m.div
            key={currentScreen.id}
            className="absolute inset-0 w-full h-full bg-background"
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={Spring.presets.smooth}
            onAnimationComplete={() => {
              // Only call completion handler when entering
              if (!isNavigating) return
              handleAnimationComplete()
            }}
          >
            <ScreenRenderer
              screen={currentScreen}
              renderScreen={renderScreen}
            />
          </m.div>
        </AnimatePresence>
      </div>
    </MobileGestureHandler>
  )
}

interface ScreenRendererProps {
  screen: MobileNavigationScreen
  renderScreen: (screen: MobileNavigationScreen) => React.ReactNode
}

const ScreenRenderer: React.FC<ScreenRendererProps> = ({
  screen,
  renderScreen,
}) => {
  return (
    <div className="h-full w-full flex flex-col">{renderScreen(screen)}</div>
  )
}

// Navigation hook for components to use
export const useStackNavigation = () => {
  const push = useMobileNavigationStore((state) => state.push)
  const pop = useMobileNavigationStore((state) => state.pop)
  const popToRoot = useMobileNavigationStore((state) => state.popToRoot)
  const replace = useMobileNavigationStore((state) => state.replace)
  const canGoBack = useMobileNavigationStore((state) => state.canGoBack)
  const isNavigating = useMobileNavigationSelectors.useIsNavigating()
  const currentScreen = useMobileNavigationSelectors.useCurrentScreen()

  return {
    push,
    pop,
    popToRoot,
    replace,
    canGoBack: canGoBack(),
    isNavigating,
    currentScreen,
  }
}
