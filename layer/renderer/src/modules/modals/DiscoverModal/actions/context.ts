import type { DiscoverProviderId } from '~/atoms/settings/discover'
import { storage, STORAGE_KEYS } from '~/lib/storage-keys'

import { discoverModalStore } from '../store'
import type { DiscoverFilterState } from '../types'

const SEARCH_HISTORY_STORAGE_KEY = STORAGE_KEYS.DISCOVER_SEARCH_HISTORY
export const SEARCH_HISTORY_LIMIT = 10

const isBrowser = typeof window !== 'undefined'

const ensureFilterClone = (filters: DiscoverFilterState) => ({
  ...filters,
})

type DiscoverSearchHistoryStorage = Partial<
  Record<DiscoverProviderId, string[]>
>

const readHistoryMap = (): DiscoverSearchHistoryStorage => {
  if (!isBrowser) {
    return {}
  }
  return (
    storage.getJSON<DiscoverSearchHistoryStorage>(SEARCH_HISTORY_STORAGE_KEY) ??
    {}
  )
}

const writeHistoryMap = (next: DiscoverSearchHistoryStorage) => {
  if (!isBrowser) {
    return
  }
  if (Object.keys(next).length === 0) {
    storage.removeItem(SEARCH_HISTORY_STORAGE_KEY)
  } else {
    storage.setJSON(SEARCH_HISTORY_STORAGE_KEY, next)
  }
}

export interface DiscoverActionContext {
  ensureFilterClone: typeof ensureFilterClone
  getState: typeof discoverModalStore.getState
  setState: typeof discoverModalStore.setState
  search: {
    nextToken: () => number
    currentToken: () => number
    invalidate: () => void
  }
  preview: {
    nextToken: () => number
    currentToken: () => number
    invalidate: () => void
  }
  history: {
    load: (providerId: DiscoverProviderId) => string[]
    persist: (providerId: DiscoverProviderId, history: string[]) => void
  }
}

export const createActionContext = (): DiscoverActionContext => {
  let searchToken = 0
  let previewToken = 0

  const loadHistory = (providerId: DiscoverProviderId) => {
    const history = readHistoryMap()[providerId]
    return history ? [...history] : []
  }

  const persistHistory = (
    providerId: DiscoverProviderId,
    history: string[],
  ) => {
    const map = readHistoryMap()
    if (history.length > 0) {
      map[providerId] = history
    } else {
      delete map[providerId]
    }
    writeHistoryMap(map)
  }

  return {
    ensureFilterClone,
    getState: discoverModalStore.getState,
    setState: discoverModalStore.setState,
    search: {
      nextToken: () => ++searchToken,
      currentToken: () => searchToken,
      invalidate: () => {
        searchToken += 1
      },
    },
    preview: {
      nextToken: () => ++previewToken,
      currentToken: () => previewToken,
      invalidate: () => {
        previewToken += 1
      },
    },
    history: {
      load: loadHistory,
      persist: persistHistory,
    },
  }
}
