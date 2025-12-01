import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createWithEqualityFn } from 'zustand/traditional'

import type { DiscoverProviderId } from '~/atoms/settings/discover'
import type {
  DiscoverFilterDefinition,
  DiscoverItem,
  DiscoverItemDetail,
  DiscoverPreviewDescriptionRenderer,
} from '~/modules/discover'

import type { DiscoverCommittedSearchState, DiscoverFilterState } from './types'

export interface DiscoverModalState {
  activeProviderId: DiscoverProviderId
  providerReady: boolean
  pageSize: number
  previewDescriptionRenderer: DiscoverPreviewDescriptionRenderer
  totalPages: number
  keyword: string
  filters: DiscoverFilterState
  defaultFilters: DiscoverFilterState
  filterDefinitions: DiscoverFilterDefinition[]
  searchHistory: string[]
  committedSearch: DiscoverCommittedSearchState | null
  items: DiscoverItem[]
  total: number | null
  hasMore: boolean
  isSearching: boolean
  searchError: string | null
  selectedIds: Set<string>
  previewId: string | null
  previewDetail: DiscoverItemDetail | null
  isPreviewLoading: boolean
  previewError: string | null
  importing: boolean
}

const createInitialState = (): DiscoverModalState => ({
  activeProviderId: 'mteam' as DiscoverProviderId,
  providerReady: false,
  pageSize: 20,
  previewDescriptionRenderer: 'markdown',
  keyword: '',
  filters: {},
  defaultFilters: {},
  filterDefinitions: [],
  searchHistory: [],
  totalPages: 0,
  committedSearch: null,
  items: [],
  total: null,
  hasMore: false,
  isSearching: false,
  searchError: null,
  selectedIds: new Set<string>(),
  previewId: null,
  previewDetail: null,
  isPreviewLoading: false,
  previewError: null,
  importing: false,
})

export const useDiscoverModalStore = createWithEqualityFn<DiscoverModalState>()(
  subscribeWithSelector(immer(() => createInitialState())),
)

export const discoverModalStore = {
  getState: () => useDiscoverModalStore.getState(),
  setState: (
    updater: DiscoverModalState | ((draft: DiscoverModalState) => void),
    replace = false,
  ) => {
    if (typeof updater === 'function') {
      if (replace) {
        useDiscoverModalStore.setState(updater, true)
      } else {
        useDiscoverModalStore.setState(updater)
      }
    } else {
      useDiscoverModalStore.setState(updater, true)
    }
  },
  reset: () => {
    useDiscoverModalStore.setState(createInitialState(), true)
  },
}
