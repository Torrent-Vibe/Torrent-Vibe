import * as React from 'react'
import { createContext, useEffect } from 'react'

import type { MobileNavigationScreen } from './mobile-navigation-store'
import { useMobileNavigationStore } from './mobile-navigation-store'

interface MobileNavigationContextType {
  initialized: boolean
}

const MobileNavigationContext = createContext<MobileNavigationContextType>({
  initialized: false,
})

export const useMobileNavigationContext = () => {
  const context = React.use(MobileNavigationContext)
  if (!context) {
    throw new Error(
      'useMobileNavigationContext must be used within MobileNavigationProvider',
    )
  }
  return context
}

interface MobileNavigationProviderProps {
  children: React.ReactNode
  initialScreen: Omit<MobileNavigationScreen, 'id' | 'canGoBack'>
  onBackAction?: () => void
}

export const MobileNavigationProvider: React.FC<
  MobileNavigationProviderProps
> = ({ children, initialScreen, onBackAction }) => {
  const push = useMobileNavigationStore((state) => state.push)
  const pop = useMobileNavigationStore((state) => state.pop)
  const screens = useMobileNavigationStore((state) => state.screens)
  const setIsNavigating = useMobileNavigationStore(
    (state) => state.setIsNavigating,
  )

  // Initialize navigation stack with root screen
  useEffect(() => {
    if (screens.length === 0) {
      push({
        ...initialScreen,
        canGoBack: false, // Root screen cannot go back
      })
    }
  }, [push, initialScreen, screens.length])

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault()

      const canPop = pop()

      if (!canPop) {
        // If we can't pop (at root), call the external back handler
        onBackAction?.()
      }
    }

    // Add popstate listener
    window.addEventListener('popstate', handlePopState)

    // Push initial state to enable back button handling
    window.history.pushState({ mobileNavigationRoot: true }, '')

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [pop, onBackAction])

  // Handle keyboard navigation (Escape key for back)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()

        const canPop = pop()

        if (!canPop) {
          onBackAction?.()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [pop, onBackAction])

  // Cleanup navigation state on unmount
  useEffect(() => {
    return () => {
      // Reset navigation state when provider unmounts
      useMobileNavigationStore.setState({
        screens: [],
        currentScreenIndex: -1,
        isNavigating: false,
        navigationDirection: null,
        currentScreen: null,
      })
    }
  }, [])

  // Prevent navigation during animations
  useEffect(() => {
    const unsubscribe = useMobileNavigationStore.subscribe(
      (state) => state.isNavigating,
      (isNavigating) => {
        if (isNavigating) {
          // Disable browser back button during navigation
          const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ''
            return ''
          }

          window.addEventListener('beforeunload', handleBeforeUnload)

          // Re-enable after animation completes
          const timeout = setTimeout(() => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            setIsNavigating(false)
          }, 500) // Slightly longer than animation duration

          return () => {
            clearTimeout(timeout)
            window.removeEventListener('beforeunload', handleBeforeUnload)
          }
        }
      },
    )

    return unsubscribe
  }, [setIsNavigating])

  const contextValue: MobileNavigationContextType = {
    initialized: screens.length > 0,
  }

  return (
    <MobileNavigationContext value={contextValue}>
      {children}
    </MobileNavigationContext>
  )
}

// Navigation utilities
export const NavigationUtils = {
  // Check if currently at root screen
  isAtRoot: () => {
    const state = useMobileNavigationStore.getState()
    return state.screens.length <= 1
  },

  // Get current screen depth
  getCurrentDepth: () => {
    const state = useMobileNavigationStore.getState()
    return state.screens.length
  },

  // Get navigation breadcrumb
  getBreadcrumb: () => {
    const state = useMobileNavigationStore.getState()
    return state.screens.map((screen) => ({
      title: screen.title,
      screenId: screen.screenId,
    }))
  },
}
