import Fuse from 'fuse.js'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createWithEqualityFn } from 'zustand/traditional'

import type { ServerState, TorrentInfo } from '~/types/torrent'

import type {
  StickyFilterEntry,
  TorrentFilterState,
  TorrentStore,
} from '../types/store'
import { STICKY_FILTER_DURATION } from '../types/store'
import { isStatusInGroup } from '../utils/status-grouping'

// Helper function to check if torrent matches a status filter (centralized)
const matchesStatusFilter = (torrent: TorrentInfo, status: string): boolean =>
  isStatusInGroup(torrent.state, status as any)

// Clean up expired sticky filter entries
const cleanExpiredStickyEntries = (
  entries: StickyFilterEntry[],
): StickyFilterEntry[] => {
  const now = Date.now()
  return entries.filter(
    (entry) => now - entry.operationTime < STICKY_FILTER_DURATION,
  )
}

// Check if a torrent should be kept visible due to sticky filter
const shouldKeepTorrentVisible = (
  torrent: TorrentInfo,
  currentFilter: TorrentFilterState,
  stickyEntries: StickyFilterEntry[],
): boolean => {
  const stickyEntry = stickyEntries.find((entry) => entry.hash === torrent.hash)
  if (!stickyEntry) return false

  // Check if the sticky entry's original filter matches the current filter
  if (
    typeof currentFilter === 'string' &&
    typeof stickyEntry.originalFilter === 'string'
  ) {
    return currentFilter === stickyEntry.originalFilter
  }

  // For object filters, do a deep comparison
  if (
    typeof currentFilter === 'object' &&
    typeof stickyEntry.originalFilter === 'object'
  ) {
    return (
      JSON.stringify(currentFilter) ===
      JSON.stringify(stickyEntry.originalFilter)
    )
  }

  return false
}

// Filter torrents based on current filter state (supports state/category/tag/multi-select)
const filterTorrents = (
  torrents: TorrentInfo[],
  filterState: TorrentFilterState,
  stickyEntries: StickyFilterEntry[] = [],
): TorrentInfo[] => {
  if (filterState === 'all') return torrents

  return torrents.filter((torrent) => {
    // First check if torrent should be kept visible due to sticky filter
    if (shouldKeepTorrentVisible(torrent, filterState, stickyEntries)) {
      return true
    }

    // Then apply normal filtering logic
    // Object-type filters: category, tag, or multi-select
    if (typeof filterState === 'object') {
      if (filterState.type === 'category') {
        return torrent.category === filterState.value
      }

      if (filterState.type === 'tag') {
        const torrentTags = (torrent.tags || '')
          .split(', ')
          .map((tag) => tag.trim())
          .filter(Boolean)
        return torrentTags.includes(filterState.value)
      }

      if (filterState.type === 'multi') {
        const { statuses = [], categories = [], tags = [] } = filterState

        // If no filters selected, show nothing
        if (
          statuses.length === 0 &&
          categories.length === 0 &&
          tags.length === 0
        ) {
          return false
        }

        let matchesStatus = statuses.length === 0
        let matchesCategory = categories.length === 0
        let matchesTag = tags.length === 0

        // Check status filters (OR logic within statuses)
        if (statuses.length > 0) {
          matchesStatus = statuses.some((status) =>
            matchesStatusFilter(torrent, status),
          )
        }

        // Check category filters (OR logic within categories)
        if (categories.length > 0) {
          matchesCategory = categories.includes(torrent.category)
        }

        // Check tag filters (OR logic within tags)
        if (tags.length > 0) {
          const torrentTags = new Set(
            (torrent.tags || '')
              .split(', ')
              .map((tag) => tag.trim())
              .filter(Boolean),
          )
          matchesTag = tags.some((tag) => torrentTags.has(tag))
        }

        // All selected filter types must match (AND logic between filter types)
        return matchesStatus && matchesCategory && matchesTag
      }

      return true
    }

    // String-type filters: single status filters
    return matchesStatusFilter(torrent, filterState)
  })
}

// Sorting utility function
const sortTorrents = (
  torrents: TorrentInfo[],
  sortKey: keyof TorrentInfo,
  sortDirection: 'asc' | 'desc',
): TorrentInfo[] => {
  if (!sortKey || torrents.length === 0) return torrents

  return [...torrents].sort((a, b) => {
    const aValue = a[sortKey]
    const bValue = b[sortKey]

    // Handle different data types
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue)
      return sortDirection === 'asc' ? comparison : -comparison
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      const comparison = aValue - bValue
      return sortDirection === 'asc' ? comparison : -comparison
    }

    // Handle undefined/null values
    if (aValue == null && bValue == null) return 0
    if (aValue == null) return 1
    if (bValue == null) return -1

    // Default fallback for other types
    const comparison = String(aValue).localeCompare(String(bValue))
    return sortDirection === 'asc' ? comparison : -comparison
  })
}

// Fuzzy search index
let fuzzyIndex: Fuse<TorrentInfo> | null = null

const rebuildFuzzyIndex = (torrents: TorrentInfo[]) => {
  fuzzyIndex = new Fuse(torrents, {
    includeScore: true,
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 1,
    keys: [
      { name: 'name', weight: 0.7 },
      { name: 'category', weight: 0.2 },
      { name: 'tags', weight: 0.1 },
    ],
  })
}

// Combined filter and sort function with search support
const processFilteredSortedTorrents = (
  torrents: TorrentInfo[],
  filterState: TorrentFilterState,
  sortKey: keyof TorrentInfo,
  sortDirection: 'asc' | 'desc',
  searchQuery: string,
  stickyEntries: StickyFilterEntry[] = [],
): TorrentInfo[] => {
  const filteredByState = filterTorrents(torrents, filterState, stickyEntries)
  const normalizedQuery = (searchQuery || '').trim().toLowerCase()
  let filtered = filteredByState
  if (normalizedQuery && fuzzyIndex) {
    const matchedHashes = new Set(
      fuzzyIndex.search(normalizedQuery).map((r) => r.item.hash),
    )
    filtered = filteredByState.filter((t) => matchedHashes.has(t.hash))
  }
  return sortTorrents(filtered, sortKey, sortDirection)
}

const initialState: TorrentStore = {
  torrents: [],
  serverState: null,
  categories: null,
  tags: null,

  lastUpdated: 0,
  selectedTorrents: [],
  sortKey: 'name',
  sortDirection: 'asc',
  filterState: 'all',
  searchQuery: '',
  stickyFilterEntries: [],
  sortedTorrents: [],
  torrentsByHash: {},
}

export const useTorrentDataStore = createWithEqualityFn<TorrentStore>()(
  subscribeWithSelector(immer(() => initialState)),
)
// eslint-disable-next-line unused-imports/no-unused-vars
const { setState: set, getState: get } = useTorrentDataStore

export const torrentDataStoreSetters = {
  setTorrents: (torrents: TorrentInfo[]) =>
    set((state) => {
      state.torrents = torrents

      // Build hash-based lookup using references to prevent memory duplication
      state.torrentsByHash = {}
      for (const torrent of torrents) {
        state.torrentsByHash[torrent.hash] = torrent
      }

      rebuildFuzzyIndex(torrents)

      // Clean up expired sticky entries
      state.stickyFilterEntries = cleanExpiredStickyEntries(
        state.stickyFilterEntries,
      )

      state.sortedTorrents = processFilteredSortedTorrents(
        torrents,
        state.filterState,
        state.sortKey,
        state.sortDirection,
        state.searchQuery || '',
        state.stickyFilterEntries,
      )
    }),

  setServerState: (serverState: ServerState) =>
    set((state) => {
      state.serverState = serverState
    }),

  updateLastFetched: () =>
    set((state) => {
      state.lastUpdated = Date.now()
    }),

  toggleTorrentSelection: (hash: string) =>
    set((state) => {
      const index = state.selectedTorrents.indexOf(hash)
      if (index !== -1) {
        state.selectedTorrents.splice(index, 1)
      } else {
        state.selectedTorrents.push(hash)
      }
    }),

  selectTorrents: (hashes: string[]) =>
    set((state) => {
      state.selectedTorrents = hashes
    }),

  toggleTorrentSelectionById: (hash: string, selected: boolean) =>
    set((state) => {
      if (selected) {
        if (!state.selectedTorrents.includes(hash)) {
          state.selectedTorrents.push(hash)
        }
      } else {
        const index = state.selectedTorrents.indexOf(hash)
        if (index !== -1) {
          state.selectedTorrents.splice(index, 1)
        }
      }
    }),

  clearSelection: () =>
    set((state) => {
      state.selectedTorrents = []
    }),

  selectAllTorrents: () =>
    set((state) => {
      state.selectedTorrents = state.sortedTorrents.map((t) => t.hash)
    }),

  setSorting: (key: keyof TorrentInfo, direction: 'asc' | 'desc') =>
    set((state) => {
      state.sortKey = key
      state.sortDirection = direction
      state.sortedTorrents = processFilteredSortedTorrents(
        state.torrents,
        state.filterState,
        key,
        direction,
        state.searchQuery || '',
        state.stickyFilterEntries,
      )
    }),

  setFilter: (filterState: TorrentFilterState) =>
    set((state) => {
      state.filterState = filterState
      state.selectedTorrents = []
      state.sortedTorrents = processFilteredSortedTorrents(
        state.torrents,
        filterState,
        state.sortKey,
        state.sortDirection,
        state.searchQuery || '',
        state.stickyFilterEntries,
      )
    }),

  toggleStatusFilter: (status: string) =>
    set((state) => {
      const currentFilter = state.filterState
      let newFilter: TorrentFilterState

      if (typeof currentFilter === 'object' && currentFilter.type === 'multi') {
        const statuses = [...(currentFilter.statuses || [])]
        const statusIndex = statuses.indexOf(status)

        if (statusIndex !== -1) {
          statuses.splice(statusIndex, 1)
        } else {
          statuses.push(status)
        }

        newFilter = {
          type: 'multi',
          statuses,
          categories: currentFilter.categories || [],
          tags: currentFilter.tags || [],
        }
      } else if (currentFilter === status) {
        // If single filter matches, switch to 'all'
        newFilter = 'all'
      } else if (currentFilter === 'all' || typeof currentFilter === 'string') {
        // Create new multi-select with this status
        newFilter = {
          type: 'multi',
          statuses: [status],
          categories: [],
          tags: [],
        }
      } else {
        // From category/tag filter, add status to new multi-select
        newFilter = {
          type: 'multi',
          statuses: [status],
          categories:
            currentFilter.type === 'category' ? [currentFilter.value] : [],
          tags: currentFilter.type === 'tag' ? [currentFilter.value] : [],
        }
      }

      state.filterState = newFilter
      state.selectedTorrents = []
      state.sortedTorrents = processFilteredSortedTorrents(
        state.torrents,
        newFilter,
        state.sortKey,
        state.sortDirection,
        state.searchQuery || '',
        state.stickyFilterEntries,
      )
    }),

  toggleCategoryFilter: (category: string) =>
    set((state) => {
      const currentFilter = state.filterState
      let newFilter: TorrentFilterState

      if (typeof currentFilter === 'object' && currentFilter.type === 'multi') {
        const categories = [...(currentFilter.categories || [])]
        const categoryIndex = categories.indexOf(category)

        if (categoryIndex !== -1) {
          categories.splice(categoryIndex, 1)
        } else {
          categories.push(category)
        }

        newFilter = {
          type: 'multi',
          statuses: currentFilter.statuses || [],
          categories,
          tags: currentFilter.tags || [],
        }
      } else if (
        typeof currentFilter === 'object' &&
        currentFilter.type === 'category' &&
        currentFilter.value === category
      ) {
        // If single category filter matches, switch to 'all'
        newFilter = 'all'
      } else {
        // Convert current filter to multi-select and add category
        const currentStatuses: string[] = []
        const currentTags: string[] = []

        // Preserve current status filter
        if (typeof currentFilter === 'string' && currentFilter !== 'all') {
          currentStatuses.push(currentFilter)
        }

        // Preserve current tag filter
        if (typeof currentFilter === 'object' && currentFilter.type === 'tag') {
          currentTags.push(currentFilter.value)
        }

        newFilter = {
          type: 'multi',
          statuses: currentStatuses,
          categories: [category],
          tags: currentTags,
        }
      }

      state.filterState = newFilter
      state.selectedTorrents = []
      state.sortedTorrents = processFilteredSortedTorrents(
        state.torrents,
        newFilter,
        state.sortKey,
        state.sortDirection,
        state.searchQuery || '',
        state.stickyFilterEntries,
      )
    }),

  toggleTagFilter: (tag: string) =>
    set((state) => {
      const currentFilter = state.filterState
      let newFilter: TorrentFilterState

      if (typeof currentFilter === 'object' && currentFilter.type === 'multi') {
        const tags = [...(currentFilter.tags || [])]
        const tagIndex = tags.indexOf(tag)

        if (tagIndex !== -1) {
          tags.splice(tagIndex, 1)
        } else {
          tags.push(tag)
        }

        newFilter = {
          type: 'multi',
          statuses: currentFilter.statuses || [],
          categories: currentFilter.categories || [],
          tags,
        }
      } else if (
        typeof currentFilter === 'object' &&
        currentFilter.type === 'tag' &&
        currentFilter.value === tag
      ) {
        // If single tag filter matches, switch to 'all'
        newFilter = 'all'
      } else {
        // Convert current filter to multi-select and add tag
        const currentStatuses: string[] = []
        const currentCategories: string[] = []

        // Preserve current status filter
        if (typeof currentFilter === 'string' && currentFilter !== 'all') {
          currentStatuses.push(currentFilter)
        }

        // Preserve current category filter
        if (
          typeof currentFilter === 'object' &&
          currentFilter.type === 'category'
        ) {
          currentCategories.push(currentFilter.value)
        }

        newFilter = {
          type: 'multi',
          statuses: currentStatuses,
          categories: currentCategories,
          tags: [tag],
        }
      }

      state.filterState = newFilter
      state.selectedTorrents = []
      state.sortedTorrents = processFilteredSortedTorrents(
        state.torrents,
        newFilter,
        state.sortKey,
        state.sortDirection,
        state.searchQuery || '',
        state.stickyFilterEntries,
      )
    }),

  setCategories: (
    categories: Record<string, { name: string; savePath: string }>,
  ) =>
    set((state) => {
      state.categories = categories
    }),

  setTags: (tags: string[]) =>
    set((state) => {
      state.tags = tags
    }),

  setSearchQuery: (query: string) =>
    set((state) => {
      state.searchQuery = query
      state.sortedTorrents = processFilteredSortedTorrents(
        state.torrents,
        state.filterState,
        state.sortKey,
        state.sortDirection,
        query || '',
        state.stickyFilterEntries,
      )
    }),

  // Add torrent hashes to sticky filter to keep them visible in current filter
  addStickyFilterEntries: (hashes: string[]) =>
    set((state) => {
      const now = Date.now()
      const currentFilter = state.filterState

      // Remove existing entries for these hashes to avoid duplicates
      state.stickyFilterEntries = state.stickyFilterEntries.filter(
        (entry) => !hashes.includes(entry.hash),
      )

      // Add new sticky entries
      const newEntries: StickyFilterEntry[] = hashes.map((hash) => ({
        hash,
        originalFilter: currentFilter,
        operationTime: now,
      }))

      state.stickyFilterEntries.push(...newEntries)
    }),

  // Remove specific torrent hashes from sticky filter
  removeStickyFilterEntries: (hashes: string[]) =>
    set((state) => {
      state.stickyFilterEntries = state.stickyFilterEntries.filter(
        (entry) => !hashes.includes(entry.hash),
      )
    }),

  // Clear all sticky filter entries
  clearStickyFilterEntries: () =>
    set((state) => {
      state.stickyFilterEntries = []
    }),
}
