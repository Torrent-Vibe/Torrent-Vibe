import { m } from 'motion/react'
import { useCallback } from 'react'

import { Button } from '~/components/ui/button'
import { cn } from '~/lib/cn'
import { Spring } from '~/lib/spring'

import { MOBILE_SETTINGS_NAVIGATION_BAR_HEIGHT } from './constants'
import {
  useMobileNavigationSelectors,
  useMobileNavigationStore,
} from './mobile-navigation-store'

interface MobileSettingsNavigationBarProps {
  className?: string
  onClose?: () => void
}

/**
 * Single instance navigation bar that automatically updates based on stack state
 * Similar to UINavigationBar architecture - hosted at the layout level
 */
export const MobileSettingsNavigationBar: React.FC<
  MobileSettingsNavigationBarProps
> = ({ onClose, className }) => {
  const currentScreen = useMobileNavigationSelectors.useCurrentScreen()
  const canGoBack = useMobileNavigationSelectors.useCanGoBack()
  const isNavigating = useMobileNavigationSelectors.useIsNavigating()
  const pop = useMobileNavigationStore((state) => state.pop)

  // Handle back navigation
  const handleBackPress = useCallback(() => {
    if (isNavigating) return

    const didPop = pop()

    // If we're at root and can't pop, call onClose
    if (!didPop && onClose) {
      onClose()
    }
  }, [isNavigating, pop, onClose])

  // Handle close (for root screen)
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose()
    }
  }, [onClose])

  // Determine navigation state
  const isRootScreen = currentScreen?.screenId === 'root'
  const showBackButton = canGoBack && !isRootScreen
  const showCloseButton = isRootScreen

  // Get title from current screen
  const title = currentScreen?.title || 'Settings'

  return (
    <header
      style={{ height: MOBILE_SETTINGS_NAVIGATION_BAR_HEIGHT }}
      className={cn(
        'flex items-center justify-between px-4 py-3',
        'bg-background border-b border-border',
        'h-[56px] relative z-10',
        'shrink-0', // Prevent header from shrinking
        className,
      )}
    >
      {/* Left Side - Back Button */}
      <div className="flex items-center min-w-0 flex-1 macos:electron:pl-16">
        {showBackButton && (
          <m.div
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            initial={{ opacity: 0, x: -10 }}
            key="back-button"
            transition={Spring.presets.smooth}
          >
            <Button
              aria-label="Go back"
              disabled={isNavigating}
              size="sm"
              variant="ghost"
              className={cn(
                'p-2 -ml-2 mr-2 min-w-[40px] h-[40px]',
                'hover:bg-fill-tertiary active:bg-fill',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
              onClick={handleBackPress}
            >
              <i className="i-mingcute-arrow-left-line text-lg text-accent" />
            </Button>
          </m.div>
        )}

        {/* Left spacing when no back button */}
        {!showBackButton && <div className="w-2" />}
      </div>

      {/* Center - Title */}
      <div className="flex-1 flex justify-center items-center px-4">
        <m.h1
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          initial={{ opacity: 0, y: -5 }}
          key={`title-${currentScreen?.id || 'unknown'}`}
          transition={Spring.presets.smooth}
          className={cn(
            'text-lg font-semibold text-text',
            'truncate max-w-full text-center',
          )}
        >
          {title}
        </m.h1>
      </div>

      {/* Right Side - Close Button (for root) */}
      <div className="flex items-center justify-end min-w-0 flex-1">
        {showCloseButton && (
          <m.div
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            initial={{ opacity: 0, x: 10 }}
            key="close-button"
            transition={Spring.presets.smooth}
          >
            <Button
              aria-label="Close settings"
              size="sm"
              variant="ghost"
              className={cn(
                'p-2 -mr-2 ml-2 min-w-[40px] h-[40px]',
                'hover:bg-fill-tertiary active:bg-fill',
                'text-text-secondary hover:text-text',
              )}
              onClick={handleClose}
            >
              <i className="i-mingcute-close-line text-lg" />
            </Button>
          </m.div>
        )}

        {/* Right spacing when no close button */}
        {!showCloseButton && <div className="w-2" />}
      </div>
    </header>
  )
}
