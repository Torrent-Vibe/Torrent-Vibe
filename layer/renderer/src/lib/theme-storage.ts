import { storage, STORAGE_KEYS } from './storage-keys'

/**
 * Theme storage utilities
 * These utilities handle the theme persistence that's used in index.html
 */

export type ThemeMode = 'light' | 'dark' | 'system'

export const themeStorage = {
  /**
   * Get the current theme mode from storage
   */
  getThemeMode: (): ThemeMode | null => {
    return storage.getJSON<ThemeMode>(STORAGE_KEYS.THEME)
  },

  /**
   * Set the theme mode in storage
   */
  setThemeMode: (mode: ThemeMode): boolean => {
    return storage.setJSON(STORAGE_KEYS.THEME, mode)
  },

  /**
   * Remove theme mode from storage (use system default)
   */
  removeThemeMode: (): boolean => {
    return storage.removeItem(STORAGE_KEYS.THEME)
  },
}

/**
 * Note: The actual theme switching is handled by the script in index.html
 * These utilities are for React components that need to interact with theme storage
 */
