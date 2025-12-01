import { m } from 'motion/react'
import { useCallback } from 'react'

import { Button } from '~/components/ui/button'
import { cn } from '~/lib/cn'
import { Spring } from '~/lib/spring'

import { useMobileNavigationSelectors } from './mobile-navigation-store'
import { useStackNavigation } from './MobileStackNavigator'

interface MobileSettingsHeaderProps {
  className?: string
  showBackButton?: boolean
  title?: string
  rightContent?: React.ReactNode
  onBackPress?: () => void
}

export const MobileSettingsHeader: React.FC<MobileSettingsHeaderProps> = ({
  className,
  showBackButton,
  title,
  rightContent,
  onBackPress,
}) => {
  const currentScreen = useMobileNavigationSelectors.useCurrentScreen()
  const canGoBack = useMobileNavigationSelectors.useCanGoBack()
  const isNavigating = useMobileNavigationSelectors.useIsNavigating()
  const navigationDirection =
    useMobileNavigationSelectors.useNavigationDirection()
  const { pop } = useStackNavigation()

  // Determine if back button should be shown
  const shouldShowBackButton =
    showBackButton ?? (canGoBack && currentScreen?.canGoBack)

  // Get title from prop or current screen
  const displayTitle = title ?? currentScreen?.title ?? 'Settings'

  // Handle back button press
  const handleBackPress = useCallback(() => {
    if (isNavigating) return // Prevent navigation during animation

    if (onBackPress) {
      onBackPress()
    } else {
      pop()
    }
  }, [isNavigating, onBackPress, pop])

  // Determine title animation based on navigation direction
  const getTitleAnimation = useCallback(() => {
    switch (navigationDirection) {
      case 'push': {
        // Pushing new screen: title slides in from right, exits to left
        return {
          initial: { opacity: 0, x: 20 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -20 },
        }
      }
      case 'pop': {
        // Popping screen: title slides in from left, exits to right
        return {
          initial: { opacity: 0, x: -20 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: 20 },
        }
      }
      default: {
        // No navigation or replace: use y-axis animation as fallback
        return {
          initial: { opacity: 0, y: -5 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: 5 },
        }
      }
    }
  }, [navigationDirection])

  return (
    <header
      className={cn(
        'flex items-center justify-between px-4 py-3',
        'bg-background border-b border-border',
        'h-[56px] relative z-10',
        className,
      )}
    >
      {/* Left Side - Back Button */}
      <div className="flex items-center min-w-0 flex-1">
        {shouldShowBackButton && (
          <m.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={Spring.presets.smooth}
          >
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'p-2 -ml-2 mr-2 min-w-[40px] h-[40px]',
                'hover:bg-fill-tertiary active:bg-fill',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
              onClick={handleBackPress}
              disabled={isNavigating}
              aria-label="Go back"
            >
              <i className="i-mingcute-arrow-left-line text-lg text-accent" />
            </Button>
          </m.div>
        )}

        {/* Left spacing when no back button */}
        {!shouldShowBackButton && <div className="w-2" />}
      </div>

      {/* Center - Title */}
      <div className="flex-1 flex justify-center items-center px-4">
        <m.h1
          key={displayTitle}
          className={cn(
            'text-lg font-semibold text-text',
            'truncate max-w-full text-center',
          )}
          {...getTitleAnimation()}
          transition={Spring.presets.smooth}
        >
          {displayTitle}
        </m.h1>
      </div>

      {/* Right Side - Custom Content */}
      <div className="flex items-center justify-end min-w-0 flex-1">
        {rightContent && (
          <m.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={Spring.presets.smooth}
          >
            {rightContent}
          </m.div>
        )}

        {/* Right spacing when no content */}
        {!rightContent && <div className="w-2" />}
      </div>
    </header>
  )
}

// Header with close button (for root/modal)
interface MobileSettingsHeaderWithCloseProps
  extends Omit<MobileSettingsHeaderProps, 'rightContent'> {
  onClose?: () => void
  showCloseButton?: boolean
}

export const MobileSettingsHeaderWithClose: React.FC<
  MobileSettingsHeaderWithCloseProps
> = ({ onClose, showCloseButton = true, ...headerProps }) => {
  const handleClose = useCallback(() => {
    onClose?.()
  }, [onClose])

  const closeButton = showCloseButton ? (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'p-2 -mr-2 ml-2 min-w-[40px] h-[40px]',
        'hover:bg-fill-tertiary active:bg-fill',
        'text-text-secondary hover:text-text',
      )}
      onClick={handleClose}
      aria-label="Close settings"
    >
      <i className="i-mingcute-close-line text-lg" />
    </Button>
  ) : undefined

  return <MobileSettingsHeader {...headerProps} rightContent={closeButton} />
}
