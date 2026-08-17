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

import { readLastProvider } from './actions/lastProviderPersist'
import type { MikanStackFrame } from './mikan/stack'
import { emptyMikanBrowseScroll } from './mikan/stack'
import type { DiscoverCommittedSearchState, DiscoverFilterState } from './types'

export interface DiscoverModalState {
  activeProviderId: DiscoverProviderId
  committedSearch: DiscoverCommittedSearchState | null
  defaultFilters: DiscoverFilterState
  filterDefinitions: DiscoverFilterDefinition[]
  filters: DiscoverFilterState
  hasMore: boolean
  importing: boolean
  isPreviewLoading: boolean
  isSearching: boolean
  items: DiscoverItem[]
  keyword: string
  mikanBangumiId: string | null
  mikanBrowseScroll: { wall: number; search: number }
  mikanDetail: DiscoverItemDetail | null
  mikanDetailError: string | null
  mikanDetailLoading: boolean
  mikanStack: MikanStackFrame[]
  mikanSubgroupId: string | null
  pageSize: number
  previewDescriptionRenderer: DiscoverPreviewDescriptionRenderer
  previewDetail: DiscoverItemDetail | null
  previewError: string | null
  previewId: string | null
  providerReady: boolean
  searchError: string | null
  searchHistory: string[]
  selectedIds: Set<string>
  total: number | null
  totalPages: number
}

const createInitialState = (): DiscoverModalState => ({
  activeProviderId: readLastProvider() ?? ('mteam' as DiscoverProviderId),
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
  mikanStack: [],
  mikanBrowseScroll: emptyMikanBrowseScroll(),
  mikanBangumiId: null,
  mikanDetail: null,
  mikanDetailLoading: false,
  mikanDetailError: null,
  mikanSubgroupId: null,
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
