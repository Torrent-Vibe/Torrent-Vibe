import { atom } from 'jotai'

import { ipcServices } from '~/lib/ipc-client'
import { createAtomHooks } from '~/lib/jotai'
import { storage, STORAGE_KEYS } from '~/lib/storage-keys'

export type PollingInterval = 1000 | 3000 | 5000 | 10000 | 30000

export const POLLING_INTERVAL_OPTIONS = [
  {
    value: 1000 as const,
    labelKey: 'general.polling.interval.values.1' as const,
  },
  {
    value: 3000 as const,
    labelKey: 'general.polling.interval.values.3' as const,
  },
  {
    value: 5000 as const,
    labelKey: 'general.polling.interval.values.5' as const,
  },
  {
    value: 10000 as const,
    labelKey: 'general.polling.interval.values.10' as const,
  },
  {
    value: 30000 as const,
    labelKey: 'general.polling.interval.values.30' as const,
  },
] as const

const DEFAULT_POLLING_INTERVAL: PollingInterval = 3000

function loadPollingInterval(): PollingInterval {
  try {
    const stored = storage.getItem(STORAGE_KEYS.POLLING_INTERVAL)
    if (stored) {
      const parsed = Number(stored) as PollingInterval
      if (POLLING_INTERVAL_OPTIONS.some((option) => option.value === parsed)) {
        return parsed
      }
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_POLLING_INTERVAL
}

function savePollingInterval(interval: PollingInterval): void {
  storage.setItem(STORAGE_KEYS.POLLING_INTERVAL, interval.toString())
}

// Create polling interval atom with persistence following Folo pattern
const pollingIntervalAtom = atom(loadPollingInterval())

// Create hooks using Folo pattern
const [, , usePollingInterval, , getPollingInterval, setPollingIntervalDirect] =
  createAtomHooks(pollingIntervalAtom)

// Direct setter for non-React contexts
const setPollingInterval = (interval: PollingInterval) => {
  setPollingIntervalDirect(interval)
  savePollingInterval(interval)
}

// Float window setting management
const DEFAULT_SHOW_FLOAT_ON_CLOSE = false

function loadShowFloatOnClose(): boolean {
  try {
    const stored = storage.getItem(STORAGE_KEYS.SHOW_FLOAT_ON_CLOSE)
    if (stored) {
      return stored === 'true'
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_SHOW_FLOAT_ON_CLOSE
}

function saveShowFloatOnClose(enabled: boolean): void {
  storage.setItem(STORAGE_KEYS.SHOW_FLOAT_ON_CLOSE, enabled.toString())
}

// Create show float on close atom with persistence
const showFloatOnCloseAtom = atom(loadShowFloatOnClose())

// Sync initial state to main process
const initialValue = loadShowFloatOnClose()
ipcServices?.float?.setShowFloatOnClose(initialValue)

// Create hooks using the same pattern
const [
  ,
  ,
  useShowFloatOnClose,
  ,
  getShowFloatOnClose,
  setShowFloatOnCloseDirect,
] = createAtomHooks(showFloatOnCloseAtom)

// Direct setter for non-React contexts
const setShowFloatOnClose = (enabled: boolean) => {
  setShowFloatOnCloseDirect(enabled)
  saveShowFloatOnClose(enabled)

  // Sync with main process if in Electron environment

  ipcServices?.float?.setShowFloatOnClose(enabled)
}

export {
  getPollingInterval,
  getShowFloatOnClose,
  setPollingInterval,
  setShowFloatOnClose,
  usePollingInterval,
  useShowFloatOnClose,
}
