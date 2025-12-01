import { useEffect, useState } from 'react'
import type { StateCreator } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { createWithEqualityFn } from 'zustand/traditional'

import { combineCleanupFunctions } from '~/lib/utils'

import { DEFAULT_VISIBLE_COLUMNS } from '../constants'
import { useTorrentDataStore } from './torrent-data-store'
import { selectTorrentHashByIndex } from './torrent-selectors'

// Helper function to compute TanStack state from persistent state
const computeTanStackState = (persistentState: TorrentTablePersistentState) => {
  const { visibleColumns, orderedColumns, resizeColumns } = persistentState

  // Create column visibility mapping
  const columnVisibility: Record<string, boolean> = {}
  // Select column is always visible
  columnVisibility.select = true
  // Get all column IDs dynamically (we'll handle translation at component level)
  const allColumnIds = [
    'select',
    'name',
    'size',
    'progress',
    'dlspeed',
    'upspeed',
    'eta',
    'ratio',
    'state',
    'priority',
    'tracker',
    'category',
    'tags',
    'num_seeds',
    'num_leechs',
    'downloaded',
    'uploaded',
    'amount_left',
    'time_active',
    'seeding_time',
    'added_on',
    'completion_on',
    'last_activity',
    'save_path',
  ]

  // Set visibility for other columns
  allColumnIds.forEach((colId) => {
    if (colId !== 'select') {
      columnVisibility[colId] = visibleColumns.includes(colId)
    }
  })

  // Create column order with select first
  const columnOrder = ['select', ...orderedColumns]

  return {
    columnVisibility,
    columnOrder,
    columnSizing: resizeColumns,
  }
}

// State interfaces
export interface TorrentTableSortState {
  sortKey: string | null
  sortDirection: 'asc' | 'desc'
}

export interface TorrentTableDragState {
  isDragging: boolean
  draggedColumnId: string | null
  dropZoneColumnId: string | null
  dragOffset: { x: number; y: number }
}

export interface TorrentTablePersistentState {
  visibleColumns: string[]
  orderedColumns: string[]
  resizeColumns: Record<string, number>
  sortState: TorrentTableSortState
}

export interface TorrentTableSessionState {
  dragState: TorrentTableDragState
  // TanStack Table states (non-persistent)
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
  columnSizing: Record<string, number>
  // Active torrent for detail view
  activeTorrentHash: string | null
}

// Actions interface
export interface TorrentTableActions {
  // Persistent state actions
  setVisibleColumns: (columns: string[]) => void
  addVisibleColumn: (columnId: string) => void
  removeVisibleColumn: (columnId: string) => void
  toggleVisibleColumn: (columnId: string) => void

  setOrderedColumns: (columns: string[]) => void
  reorderColumns: (
    fromIndex: number,
    toIndex: string,
    newOrder: string[],
  ) => void

  setResizeColumns: (columns: Record<string, number>) => void
  setColumnSize: (columnId: string, size: number) => void

  setSortState: (state: Partial<TorrentTableSortState>) => void
  updateSort: (sortKey: string, sortDirection: 'asc' | 'desc') => void

  // Session state actions
  setDragState: (state: Partial<TorrentTableDragState>) => void
  startDrag: (columnId: string) => void
  endDrag: () => void

  setColumnOrder: (order: string[]) => void
  updateColumnOrder: (
    updater: string[] | ((prev: string[]) => string[]),
  ) => void

  setColumnVisibility: (visibility: Record<string, boolean>) => void
  updateColumnVisibility: (
    updater:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void

  setColumnSizing: (sizing: Record<string, number>) => void
  updateColumnSizing: (
    updater:
      | Record<string, number>
      | ((prev: Record<string, number>) => Record<string, number>),
  ) => void

  // Active torrent actions
  setActiveTorrentHash: (hash: string | null) => void

  // Utility actions
  resetToDefaults: () => void
  syncTanStackState: () => void
}

// Complete store interface
export interface TorrentTableStore
  extends TorrentTablePersistentState,
    TorrentTableSessionState,
    TorrentTableActions {}

// Default states
const defaultPersistentState: TorrentTablePersistentState = {
  visibleColumns: DEFAULT_VISIBLE_COLUMNS.slice(),
  orderedColumns: DEFAULT_VISIBLE_COLUMNS.slice(),
  resizeColumns: {},
  sortState: { sortKey: null, sortDirection: 'asc' },
}

// Compute initial TanStack state from default persistent state
const initialTanStackState = computeTanStackState(defaultPersistentState)

const defaultSessionState: TorrentTableSessionState = {
  dragState: {
    isDragging: false,
    draggedColumnId: null,
    dropZoneColumnId: null,
    dragOffset: { x: 0, y: 0 },
  },
  activeTorrentHash: null,
  ...initialTanStackState,
}

// Store slice creator
const createTorrentTableSlice: StateCreator<
  TorrentTableStore,
  [['zustand/subscribeWithSelector', never], ['zustand/persist', unknown]],
  [],
  TorrentTableStore
> = (set, get) => ({
  // Initial state
  ...defaultPersistentState,
  ...defaultSessionState,

  // Persistent state actions
  setVisibleColumns: (columns) => {
    set({ visibleColumns: columns })
    get().syncTanStackState()
  },

  addVisibleColumn: (columnId) => {
    const { visibleColumns } = get()
    if (!visibleColumns.includes(columnId)) {
      const newColumns = [...visibleColumns, columnId]
      set({ visibleColumns: newColumns })
      get().syncTanStackState()
    }
  },

  removeVisibleColumn: (columnId) => {
    const { visibleColumns } = get()
    const newColumns = visibleColumns.filter((id) => id !== columnId)
    // Ensure at least one column remains visible
    if (newColumns.length > 0) {
      set({ visibleColumns: newColumns })
      get().syncTanStackState()
    }
  },

  toggleVisibleColumn: (columnId) => {
    const { visibleColumns } = get()
    if (visibleColumns.includes(columnId)) {
      get().removeVisibleColumn(columnId)
    } else {
      get().addVisibleColumn(columnId)
    }
  },

  setOrderedColumns: (columns) => {
    set({ orderedColumns: columns })
    get().syncTanStackState()
  },

  reorderColumns: (fromIndex, toIndex, newOrder) => {
    set({ orderedColumns: newOrder })
    get().syncTanStackState()
  },

  setResizeColumns: (columns) => {
    set({ resizeColumns: columns, columnSizing: columns })
  },

  setColumnSize: (columnId, size) => {
    const { resizeColumns } = get()
    const newResizeColumns = { ...resizeColumns, [columnId]: size }
    set({
      resizeColumns: newResizeColumns,
      columnSizing: newResizeColumns,
    })
  },

  setSortState: (state) => {
    set((prev) => ({
      sortState: { ...prev.sortState, ...state },
    }))
  },

  updateSort: (sortKey, sortDirection) => {
    set({ sortState: { sortKey, sortDirection } })
  },

  // Session state actions
  setDragState: (state) => {
    set((prev) => ({
      dragState: { ...prev.dragState, ...state },
    }))
  },

  startDrag: (columnId) => {
    set({
      dragState: {
        isDragging: true,
        draggedColumnId: columnId,
        dropZoneColumnId: null,
        dragOffset: { x: 0, y: 0 },
      },
    })
  },

  endDrag: () => {
    set({
      dragState: {
        isDragging: false,
        draggedColumnId: null,
        dropZoneColumnId: null,
        dragOffset: { x: 0, y: 0 },
      },
    })
  },

  setColumnOrder: (order) => {
    set({ columnOrder: order })
  },

  updateColumnOrder: (updater) => {
    set((prev) => ({
      columnOrder:
        typeof updater === 'function' ? updater(prev.columnOrder) : updater,
    }))
  },

  setColumnVisibility: (visibility) => {
    set({ columnVisibility: visibility })
  },

  updateColumnVisibility: (updater) => {
    set((prev) => ({
      columnVisibility:
        typeof updater === 'function'
          ? updater(prev.columnVisibility)
          : updater,
    }))
  },

  setColumnSizing: (sizing) => {
    set({ columnSizing: sizing })
  },

  updateColumnSizing: (updater) => {
    set((prev) => {
      const newSizing =
        typeof updater === 'function' ? updater(prev.columnSizing) : updater
      // Sync to persistent store
      return {
        columnSizing: newSizing,
        resizeColumns: newSizing,
      }
    })
  },

  // Active torrent actions
  setActiveTorrentHash: (hash) => {
    set({ activeTorrentHash: hash })
  },

  // Utility actions
  resetToDefaults: () => {
    set({
      ...defaultPersistentState,
      ...defaultSessionState,
    })
  },

  syncTanStackState: () => {
    const currentState = get()
    const persistentState: TorrentTablePersistentState = {
      visibleColumns: currentState.visibleColumns,
      orderedColumns: currentState.orderedColumns,
      resizeColumns: currentState.resizeColumns,
      sortState: currentState.sortState,
    }

    const tanStackState = computeTanStackState(persistentState)
    set(tanStackState)
  },
})

// Create the store with persistence
export const useTorrentTableStore = createWithEqualityFn<TorrentTableStore>()(
  subscribeWithSelector(
    persist(createTorrentTableSlice, {
      name: 'torrent-table-store',
      partialize: (state): TorrentTablePersistentState => ({
        visibleColumns: state.visibleColumns,
        orderedColumns: state.orderedColumns,
        resizeColumns: state.resizeColumns,
        sortState: state.sortState,
      }),
      onRehydrateStorage: () => (state) => {
        // After rehydration, immediately compute correct TanStack state
        if (state) {
          const persistentState: TorrentTablePersistentState = {
            visibleColumns: state.visibleColumns,
            orderedColumns: state.orderedColumns,
            resizeColumns: state.resizeColumns,
            sortState: state.sortState,
          }

          const tanStackState = computeTanStackState(persistentState)

          // Directly update the state without triggering sync
          Object.assign(state, tanStackState)
        }
      },
    }),
  ),
)

// Selector hooks for better performance
export const useTorrentTableSelectors = {
  // Persistent state selectors
  useVisibleColumns: () =>
    useTorrentTableStore((state) => state.visibleColumns),
  useOrderedColumns: () =>
    useTorrentTableStore((state) => state.orderedColumns),
  useResizeColumns: () => useTorrentTableStore((state) => state.resizeColumns),
  useSortState: () => useTorrentTableStore((state) => state.sortState),

  // Session state selectors
  useDragState: () => useTorrentTableStore((state) => state.dragState),
  useColumnOrder: () => useTorrentTableStore((state) => state.columnOrder),
  useColumnVisibility: () =>
    useTorrentTableStore((state) => state.columnVisibility),
  useColumnSizing: () => useTorrentTableStore((state) => state.columnSizing),
  useActiveTorrentHash: () =>
    useTorrentTableStore((state) => state.activeTorrentHash),
  useRowActiveByIndex: (index: number) => {
    const [isActive, setIsActive] = useState(false)

    useEffect(() => {
      // Calculate initial state
      const checkActiveState = () => {
        const { activeTorrentHash } = useTorrentTableStore.getState()
        const { selectedTorrents } = useTorrentDataStore.getState()
        const torrentHash = selectTorrentHashByIndex(
          useTorrentDataStore.getState(),
          index,
        )

        const isActiveTorrent =
          activeTorrentHash === torrentHash && activeTorrentHash !== null
        const isSelectedTorrent = torrentHash
          ? selectedTorrents.includes(torrentHash)
          : false

        const newIsActive = isActiveTorrent || isSelectedTorrent
        setIsActive(newIsActive)
      }

      // Set initial state
      checkActiveState()

      return combineCleanupFunctions(
        // Subscribe to active torrent hash changes
        useTorrentTableStore.subscribe((state, prev) => {
          if (state.activeTorrentHash !== prev.activeTorrentHash) {
            checkActiveState()
          }
        }),
        // Subscribe to torrent list changes that might affect this row
        useTorrentDataStore.subscribe((state, prev) => {
          const currentHash = state.sortedTorrents[index]?.hash
          const prevHash = prev.sortedTorrents[index]?.hash

          // Check if the torrent at this index changed
          if (currentHash !== prevHash) {
            checkActiveState()
            return
          }

          // Check if selectedTorrents changed for this torrent
          if (currentHash && state.selectedTorrents !== prev.selectedTorrents) {
            const wasSelected = prev.selectedTorrents.includes(currentHash)
            const isSelected = state.selectedTorrents.includes(currentHash)

            if (wasSelected !== isSelected) {
              checkActiveState()
            }
          }
        }),
      )
    }, [index])

    return isActive
  },
  // Combined selectors
  useTableConfig: () =>
    useTorrentTableStore((state) => ({
      columnOrder: state.columnOrder,
      columnVisibility: state.columnVisibility,
      columnSizing: state.columnSizing,
    })),
}

const state = useTorrentTableStore.getState()

const actions = {
  // Persistent actions
  setVisibleColumns: state.setVisibleColumns,
  addVisibleColumn: state.addVisibleColumn,
  removeVisibleColumn: state.removeVisibleColumn,
  toggleVisibleColumn: state.toggleVisibleColumn,
  setOrderedColumns: state.setOrderedColumns,
  reorderColumns: state.reorderColumns,
  setResizeColumns: state.setResizeColumns,
  setColumnSize: state.setColumnSize,
  setSortState: state.setSortState,
  updateSort: state.updateSort,

  // Session actions
  setDragState: state.setDragState,
  startDrag: state.startDrag,
  endDrag: state.endDrag,
  setColumnOrder: state.setColumnOrder,
  updateColumnOrder: state.updateColumnOrder,
  setColumnVisibility: state.setColumnVisibility,
  updateColumnVisibility: state.updateColumnVisibility,
  setColumnSizing: state.setColumnSizing,
  updateColumnSizing: state.updateColumnSizing,

  // Active torrent actions
  setActiveTorrentHash: state.setActiveTorrentHash,

  // Utility actions
  resetToDefaults: state.resetToDefaults,
  syncTanStackState: state.syncTanStackState,
}
// Action selectors for stable references
export const getTorrentTableActions = () => actions
