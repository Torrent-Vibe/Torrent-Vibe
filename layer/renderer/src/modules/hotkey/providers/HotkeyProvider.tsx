import type { ReactNode } from 'react'
import * as React from 'react'
import { createContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { HotkeyDebugger } from '../components/HotkeyDebugger'
import { FocusTracker } from '../core/focus-tracker'
import { hotkeyManager } from '../core/hotkey-manager-core'
import type { HotkeyConfig, HotkeyDebugInfo } from '../types'

interface HotkeyContextValue {
  manager: typeof hotkeyManager
  focusTracker: FocusTracker
  isEnabled: boolean
  debugInfo: HotkeyDebugInfo | null
  toggleEnabled: () => void
  toggleDebugMode: () => void
}

const HotkeyContext = createContext<HotkeyContextValue | null>(null)

export function useHotkeyContext(): HotkeyContextValue {
  const context = React.use(HotkeyContext)
  if (!context) {
    throw new Error('useHotkeyContext must be used within a HotkeyProvider')
  }
  return context
}

interface HotkeyProviderProps {
  children: ReactNode
  config?: Partial<HotkeyConfig>
  enableDebugMode?: boolean
}

export function HotkeyProvider({
  children,
  config = {},
  enableDebugMode,
}: HotkeyProviderProps) {
  const [focusTracker] = useState(() => new FocusTracker())
  const [isEnabled, setIsEnabled] = useState(true)
  const [debugInfo] = useState<HotkeyDebugInfo | null>(null)

  useEffect(() => {
    // Initialize hotkey manager configuration
    hotkeyManager.updateConfig({
      enabled: true,
      debugMode: enableDebugMode,
      preventDefault: true,
      stopPropagation: false,
      maxScopeDepth: 6,
      debounceDelay: 16,
      enablePrediction: true,
      ...config,
    })

    return () => {
      // nothing else to cleanup
      focusTracker.destroy()
    }
  }, [focusTracker, enableDebugMode, config])

  const toggleEnabled = React.useCallback(() => {
    const newEnabled = !isEnabled
    setIsEnabled(newEnabled)
    hotkeyManager.updateConfig({ enabled: newEnabled })
  }, [isEnabled])

  const toggleDebugMode = React.useCallback(() => {
    const newDebugMode = !enableDebugMode
    hotkeyManager.updateConfig({ debugMode: newDebugMode })
  }, [enableDebugMode])

  const contextValue: HotkeyContextValue = React.useMemo(
    () => ({
      manager: hotkeyManager,
      focusTracker,
      isEnabled,
      debugInfo,
      toggleEnabled,
      toggleDebugMode,
    }),
    [focusTracker, isEnabled, debugInfo, toggleEnabled, toggleDebugMode],
  )
  return (
    <HotkeyContext value={contextValue}>
      {children}
      {enableDebugMode && createPortal(<HotkeyDebugger />, document.body)}
    </HotkeyContext>
  )
}
