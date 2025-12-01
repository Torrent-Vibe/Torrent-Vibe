
// Minimal public API
export { hotkeyManager } from './core/hotkey-manager-core'
export { useFocusScope } from './hooks/use-focus-scope'
export { useHotkey } from './hooks/use-hotkey'
export { HotkeyProvider } from './providers/HotkeyProvider'
export { HotkeyScope, ScopeActivationStrategy } from './types'

// Common hotkeys used across app
export const commonHotkeys = {
  // Application hotkeys
  NEW_ITEM: '$mod+n',
  SAVE: '$mod+s',
  SETTINGS: '$mod+,',
  REFRESH: 'F5',
  QUIT: '$mod+q',

  // Selection
  SELECT_ALL: '$mod+a',
  DESELECT_ALL: 'Escape',

  // Search and filter
  SEARCH: '$mod+f',
} as const
