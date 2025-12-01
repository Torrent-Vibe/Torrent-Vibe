import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

import type { SettingsSection } from '../configs'

export interface MobileNavigationScreen {
  id: string
  screenId: SettingsSection | 'root'
  title: string
  icon?: string
  data?: Record<string, any>
  canGoBack?: boolean
}

export interface MobileNavigationState {
  // Navigation Stack
  screens: MobileNavigationScreen[]
  currentScreenIndex: number

  // Animation State
  isNavigating: boolean
  navigationDirection: 'push' | 'pop' | null

  // Screen Data
  currentScreen: MobileNavigationScreen | null

  // Actions
  push: (screen: Omit<MobileNavigationScreen, 'id'>) => void
  pop: () => boolean
  popToRoot: () => void
  replace: (screen: Omit<MobileNavigationScreen, 'id'>) => void
  canGoBack: () => boolean

  // Animation Actions
  setIsNavigating: (isNavigating: boolean) => void
  setNavigationDirection: (direction: 'push' | 'pop' | null) => void
}

// Generate unique screen ID
let screenIdCounter = 0
const generateScreenId = () => `screen_${++screenIdCounter}`

export const useMobileNavigationStore = create<MobileNavigationState>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    screens: [],
    currentScreenIndex: -1,
    isNavigating: false,
    navigationDirection: null,
    currentScreen: null,

    // Navigation Actions
    push: (screenData) => {
      const state = get()

      if (state.isNavigating) return // Prevent navigation during animation

      const newScreen: MobileNavigationScreen = {
        ...screenData,
        id: generateScreenId(),
        canGoBack: true, // All pushed screens can go back
      }

      set({
        screens: [...state.screens, newScreen],
        currentScreenIndex: state.screens.length,
        currentScreen: newScreen,
        navigationDirection: 'push',
        isNavigating: true,
      })
    },

    pop: () => {
      const state = get()

      if (state.isNavigating || state.screens.length <= 1) return false

      const newScreens = state.screens.slice(0, -1)
      const newIndex = newScreens.length - 1
      const newCurrentScreen = newScreens[newIndex] || null

      set({
        screens: newScreens,
        currentScreenIndex: newIndex,
        currentScreen: newCurrentScreen,
        navigationDirection: 'pop',
        isNavigating: true,
      })

      return true
    },

    popToRoot: () => {
      const state = get()

      if (state.isNavigating || state.screens.length <= 1) return

      const rootScreen = state.screens[0]

      set({
        screens: [rootScreen],
        currentScreenIndex: 0,
        currentScreen: rootScreen,
        navigationDirection: 'pop',
        isNavigating: true,
      })
    },

    replace: (screenData) => {
      const state = get()

      if (state.isNavigating) return

      const newScreen: MobileNavigationScreen = {
        ...screenData,
        id: generateScreenId(),
        canGoBack: state.screens.length > 1,
      }

      const newScreens = [...state.screens]
      newScreens[state.currentScreenIndex] = newScreen

      set({
        screens: newScreens,
        currentScreen: newScreen,
      })
    },

    canGoBack: () => {
      const state = get()
      return state.screens.length > 1 && !state.isNavigating
    },

    // Animation Actions
    setIsNavigating: (isNavigating) => {
      set({ isNavigating })

      if (!isNavigating) {
        // Clear navigation direction when animation completes
        setTimeout(() => {
          set({ navigationDirection: null })
        }, 50)
      }
    },

    setNavigationDirection: (direction) => {
      set({ navigationDirection: direction })
    },
  })),
)

// Navigation Actions (for external use)
export const MobileNavigationActions = {
  push: (screen: Omit<MobileNavigationScreen, 'id'>) =>
    useMobileNavigationStore.getState().push(screen),

  pop: () => useMobileNavigationStore.getState().pop(),

  popToRoot: () => useMobileNavigationStore.getState().popToRoot(),

  replace: (screen: Omit<MobileNavigationScreen, 'id'>) =>
    useMobileNavigationStore.getState().replace(screen),

  canGoBack: () => useMobileNavigationStore.getState().canGoBack(),
}

// Selectors
export const useMobileNavigationSelectors = {
  useCurrentScreen: () =>
    useMobileNavigationStore((state) => state.currentScreen),
  useCanGoBack: () => useMobileNavigationStore((state) => state.canGoBack()),
  useIsNavigating: () =>
    useMobileNavigationStore((state) => state.isNavigating),
  useNavigationDirection: () =>
    useMobileNavigationStore((state) => state.navigationDirection),
  useScreenStack: () => useMobileNavigationStore((state) => state.screens),
}
