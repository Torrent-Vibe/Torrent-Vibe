/**
 * Centralized localStorage key management
 * All localStorage keys used throughout the application should be defined here
 */

const APP_PREFIX = 'app'
const QB_PREFIX = 'qb'
const TORRENT_TABLE_PREFIX = 'torrentTable'

/**
 * Creates a namespaced storage key
 */
export const createStorageKey = (namespace: string, key: string) =>
  `${namespace}:${key}`

/**
 * Core application localStorage keys
 */
export const STORAGE_KEYS = {
  // Theme and UI preferences
  THEME: 'color-mode',
  PREFERRED_LANGUAGE: 'preferred-language',
  ACCENT_COLOR: createStorageKey(APP_PREFIX, 'accent-color'),
  COLOR_STYLE: createStorageKey(APP_PREFIX, 'color-style'),

  // Connection configuration
  CONNECTION_CONFIG: createStorageKey(QB_PREFIX, 'connection-config'),
  CONNECTION_PASSWORD: createStorageKey(QB_PREFIX, 'connection-password'),

  // Polling configuration
  POLLING_INTERVAL: createStorageKey(QB_PREFIX, 'polling-interval'),

  // Float window configuration
  SHOW_FLOAT_ON_CLOSE: createStorageKey(QB_PREFIX, 'show-float-on-close'),

  // Remote/local path mapping for desktop file operations
  PATH_MAPPINGS: createStorageKey(QB_PREFIX, 'path-mappings'),

  // Multi-server configuration (Electron-only feature; safe to exist in Web)
  MULTI_SERVER_CONFIG: createStorageKey(QB_PREFIX, 'multi-server-config'),
  serverPasswordKey: (id: string) =>
    createStorageKey(QB_PREFIX, `server:${id}:password`),

  // Discover provider configuration
  DISCOVER_PROVIDERS: createStorageKey(APP_PREFIX, 'discover-providers'),
  DISCOVER_SEARCH_HISTORY: createStorageKey(
    APP_PREFIX,
    'discover-search-history',
  ),

  // Torrent table preferences
  TORRENT_TABLE: {
    VISIBLE_COLUMNS: `${TORRENT_TABLE_PREFIX}.visibleColumns`,
    ORDERED_COLUMNS: `${TORRENT_TABLE_PREFIX}.orderedColumns`,
    SORT_STATE: `${TORRENT_TABLE_PREFIX}.sortState`,
    RESIZE_COLUMNS: `${TORRENT_TABLE_PREFIX}.resizeColumns`,
  },

  // App-namespaced keys (using existing ns.ts pattern)
  APP: {
    PREFIX: APP_PREFIX,
    createKey: (key: string) => createStorageKey(APP_PREFIX, key),
  },
} as const

/**
 * Storage utilities with key management
 */
export const storage = {
  /**
   * Get item from localStorage with proper key
   */
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key)
    } catch (error) {
      console.warn(`Failed to get localStorage item with key: ${key}`, error)
      return null
    }
  },

  /**
   * Set item in localStorage with proper key
   */
  setItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value)
      return true
    } catch (error) {
      console.warn(`Failed to set localStorage item with key: ${key}`, error)
      return false
    }
  },

  /**
   * Remove item from localStorage with proper key
   */
  removeItem: (key: string): boolean => {
    try {
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.warn(`Failed to remove localStorage item with key: ${key}`, error)
      return false
    }
  },

  /**
   * Get and parse JSON from localStorage
   */
  getJSON: <T>(key: string): T | null => {
    try {
      const value = storage.getItem(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.warn(`Failed to parse JSON from localStorage key: ${key}`, error)
      return null
    }
  },

  /**
   * Stringify and set JSON in localStorage
   */
  setJSON: <T>(key: string, value: T): boolean => {
    try {
      return storage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.warn(
        `Failed to stringify and set JSON in localStorage key: ${key}`,
        error,
      )
      return false
    }
  },

  /**
   * Clear all app-namespaced storage items
   */
  clearAppStorage: (): void => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && key.startsWith(APP_PREFIX)) {
          localStorage.removeItem(key)
        }
      }
    } catch (error) {
      console.warn('Failed to clear app storage', error)
    }
  },

  /**
   * Clear all storage items with a specific prefix
   */
  clearStorageByPrefix: (prefix: string): void => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && key.startsWith(prefix)) {
          localStorage.removeItem(key)
        }
      }
    } catch (error) {
      console.warn(`Failed to clear storage with prefix: ${prefix}`, error)
    }
  },
}

/**
 * Legacy compatibility - to maintain existing API
 */
export const getStorageNS = STORAGE_KEYS.APP.createKey
export const clearStorage = storage.clearAppStorage
