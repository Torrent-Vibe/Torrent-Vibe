import { closestCenter, DndContext, DragOverlay } from '@dnd-kit/core'
import type { Column, Table } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { titleCase } from 'title-case'
import { useShallow } from 'zustand/shallow'

import type { TorrentInfo } from '~/types'

import { DragPreview } from './components/DragComponents'
import { TableBody } from './components/TableBody'
import { TableHeader } from './components/TableHeader'
import { BASE_ROW_HEIGHT, getAllColumns } from './constants'
import { useTorrentTableColumnMenu } from './hooks/use-torrent-table-column-menu'
import { useTorrentTableDragDrop } from './hooks/use-torrent-table-drag-drop'
import { useTorrentTableHotkeys } from './hooks/use-torrent-table-hotkeys'
import { useTorrentTableVirtualization } from './hooks/use-torrent-table-virtualization'
import { torrentDataStoreSetters, useTorrentDataStore } from './stores'
import {
  selectSortedTorrents,
  selectSortState,
  selectTorrentsLength,
} from './stores/torrent-selectors'
import {
  getTorrentTableActions,
  useTorrentTableSelectors,
} from './stores/torrent-table-store'

const MemoTableHeader = React.memo(TableHeader)

export interface TorrentTableConfig {
  table: Table<TorrentInfo>
  data: TorrentInfo[]
  getRowHeight: (index: number) => number
  visibleLeafColumns: Column<TorrentInfo>[]
  visibleColumnIds: string[]
  gridTemplateColumns: string
  minTableWidth: number
  // cumulative left offsets per visible column id (in px)
  columnOffsets: Record<string, number>
}

export const TorrentTableList = () => {
  const { t } = useTranslation()
  const torrentsLength = useTorrentDataStore(selectTorrentsLength)

  if (torrentsLength === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-center">
        <i className="i-mingcute-folder-open-line text-4xl text-text-tertiary mb-4" />
        <h3 className="text-lg font-medium text-text mb-2">
          {t('torrent.emptyState.title')}
        </h3>
        <p className="text-text-secondary">
          {t('torrent.emptyState.description')}
        </p>
      </div>
    )
  }
  return <TorrentTableListImpl />
}
function TorrentTableListImpl() {
  const sortTorrents = useTorrentDataStore(selectSortedTorrents)
  const dragState = useTorrentTableSelectors.useDragState()
  const columnOrder = useTorrentTableSelectors.useColumnOrder()
  const columnVisibility = useTorrentTableSelectors.useColumnVisibility()
  const columnSizing = useTorrentTableSelectors.useColumnSizing()
  const sortState = useTorrentTableSelectors.useSortState()
  const storeSortState = useTorrentDataStore(useShallow(selectSortState))

  // Table hotkeys and focus scope management
  const { setTableScopeRef } = useTorrentTableHotkeys()

  // Get actions
  const actions = getTorrentTableActions()

  // Sorting via store and persistence
  const handleSort = React.useCallback(
    (key: string, direction: 'asc' | 'desc') => {
      torrentDataStoreSetters.setSorting(key as keyof TorrentInfo, direction)
      actions.updateSort(key, direction)
    },
    [actions],
  )

  // Initialize sort state on mount (only if not already set)
  React.useEffect(() => {
    if (sortState.sortKey && sortState.sortDirection) {
      const currentSort = selectSortState(useTorrentDataStore.getState())
      if (
        currentSort.sortKey !== sortState.sortKey
        || currentSort.sortDirection !== sortState.sortDirection
      ) {
        torrentDataStoreSetters.setSorting(
          sortState.sortKey as keyof TorrentInfo,
          sortState.sortDirection,
        )
      }
    }
  }, [sortState.sortKey, sortState.sortDirection])

  // Dynamic row height calculation using store data
  const getRowHeight = React.useCallback(() => {
    return BASE_ROW_HEIGHT
  }, [])

  const table = useReactTable({
    data: sortTorrents,
    columns: getAllColumns(),
    state: {
      columnOrder,
      columnVisibility,
      columnSizing,
    },

    onColumnOrderChange: (updater) => {
      actions.updateColumnOrder((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        // keep 'select' at index 0
        const filtered = next.filter((k: string) => k !== 'select')
        actions.setOrderedColumns(filtered)
        return ['select', ...filtered]
      })
    },
    onColumnVisibilityChange: (updater) => {
      actions.updateColumnVisibility((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        const visible = getAllColumns()
          .filter(c => c.id !== 'select')
          .map(c => c.id as string)
          .filter(k => next[k] !== false)
        // Ensure at least one column visible (besides select)
        if (visible.length === 0) {
          return prev
        }
        actions.setVisibleColumns(visible)
        return next
      })
    },
    onColumnSizingChange: (updater) => {
      actions.updateColumnSizing(updater)
    },

    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    debugTable: false,
    meta: {
      sortState: {
        sortKey: storeSortState.sortKey || undefined,
        sortDirection: storeSortState.sortDirection,
      },
      handleSort,
    },
  })

  // Derive from TanStack state each render so changes (visibility/order/size)
  // immediately reflect in layout without stale memoization
  const visibleLeafColumns = table.getVisibleLeafColumns()
  const visibleColumnIds = visibleLeafColumns.map(c => c.id)

  const gridTemplateColumns = visibleLeafColumns
    .map(c => `${c.getSize()}px`)
    .join(' ')

  // Compute cumulative left offsets for sticky support
  const columnOffsets: Record<string, number> = (() => {
    const offsets: Record<string, number> = {}
    let acc = 0
    for (const col of visibleLeafColumns) {
      offsets[col.id] = acc
      acc += col.getSize()
    }
    return offsets
  })()

  const minTableWidth = visibleLeafColumns.reduce(
    (sum: number, c: Column<TorrentInfo>) => sum + c.getSize(),
    0,
  )

  const tableConfig: TorrentTableConfig = {
    table,
    data: sortTorrents,
    getRowHeight,
    visibleLeafColumns,
    visibleColumnIds,
    gridTemplateColumns,
    minTableWidth,
    columnOffsets,
  }

  // Extract behavior logic into custom hooks
  const dragDrop = useTorrentTableDragDrop()
  const columnMenu = useTorrentTableColumnMenu()

  return (
    <DndContext
      sensors={dragDrop.sensors}
      collisionDetection={closestCenter}
      onDragStart={dragDrop.handleDragStart}
      onDragEnd={dragDrop.handleDragEnd}
    >
      <TorrentTableVirtualViewport
        columnMenu={columnMenu}
        dragState={dragState}
        setTableScopeRef={setTableScopeRef}
        tableConfig={tableConfig}
        torrentsLength={sortTorrents.length}
      />
    </DndContext>
  )
}

interface TorrentTableVirtualViewportProps {
  columnMenu: ReturnType<typeof useTorrentTableColumnMenu>
  dragState: ReturnType<typeof useTorrentTableSelectors.useDragState>
  setTableScopeRef: React.Dispatch<React.SetStateAction<HTMLDivElement>>
  tableConfig: TorrentTableConfig
  torrentsLength: number
}

function TorrentTableVirtualViewport({
  columnMenu,
  dragState,
  setTableScopeRef,
  tableConfig,
  torrentsLength,
}: TorrentTableVirtualViewportProps) {
  const {
    bodyHeight,
    handleKeyDown,
    handleWheel,
    headerHeight,
    isScrolling,
    getScrollOffset,
    rowVirtualizer,
    setBodyElement,
    setContainerElement,
    setScrollOffset,
    setScrollSamplingMode,
    totalSize,
  } = useTorrentTableVirtualization(torrentsLength)

  return (
    <div
      id="fixed-data-table"
      ref={(el) => {
        setContainerElement(el)
        // attach TABLE focus scope to the viewport element
        if (el) {
          setTableScopeRef(el)
        }
      }}
      className="relative flex flex-1 h-0 min-h-[400px] w-full flex-col overflow-hidden bg-background outline-none"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        event.currentTarget.focus({ preventScroll: true })
      }}
    >
      <MemoTableHeader {...tableConfig} columnMenu={columnMenu} />

      <DragOverlay>
        {dragState.isDragging && dragState.draggedColumnId
          ? (
              <DragPreview columnId={dragState.draggedColumnId}>
                {titleCase(dragState.draggedColumnId)}
              </DragPreview>
            )
          : null}
      </DragOverlay>

      <div
        ref={setBodyElement}
        className="relative min-h-0 flex-1 overflow-hidden"
        onWheel={handleWheel}
      >
        <TableBody
          {...tableConfig}
          rowVirtualizer={rowVirtualizer}
          viewportHeight={bodyHeight}
          headerHeight={headerHeight}
          isScrolling={isScrolling}
          logicalScrollMode
        />
      </div>

      <LogicalVerticalScrollbar
        viewportHeight={bodyHeight}
        totalSize={totalSize}
        getScrollOffset={getScrollOffset}
        setScrollOffset={setScrollOffset}
        setScrollSamplingMode={setScrollSamplingMode}
      />
    </div>
  )
}

interface LogicalVerticalScrollbarProps {
  viewportHeight: number
  totalSize: number
  getScrollOffset: () => number
  setScrollOffset: (
    nextOffset: number | ((current: number) => number),
    isScrolling?: boolean,
  ) => void
  setScrollSamplingMode: (mode: 'default' | 'drag') => void
}

function LogicalVerticalScrollbar({
  viewportHeight,
  totalSize,
  getScrollOffset,
  setScrollOffset,
  setScrollSamplingMode,
}: LogicalVerticalScrollbarProps) {
  const [dragState, setDragState] = React.useState<{
    startY: number
    startOffset: number
  } | null>(null)

  const maxScrollOffset = Math.max(0, totalSize - viewportHeight)

  const thumbHeight
    = maxScrollOffset > 0
      ? Math.max(28, Math.floor((viewportHeight / totalSize) * viewportHeight))
      : viewportHeight
  const maxThumbTop = Math.max(0, viewportHeight - thumbHeight)

  React.useEffect(() => {
    if (!dragState) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault()

      const deltaY = event.clientY - dragState.startY
      const scrollDelta
        = maxThumbTop > 0 ? (deltaY / maxThumbTop) * maxScrollOffset : 0

      setScrollOffset(dragState.startOffset + scrollDelta)
    }

    const finishDrag = () => {
      setScrollOffset(current => current)
      setScrollSamplingMode('default')
      setDragState(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', finishDrag)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishDrag)
      window.removeEventListener('pointercancel', finishDrag)
    }
  }, [
    dragState,
    maxScrollOffset,
    maxThumbTop,
    setScrollOffset,
    setScrollSamplingMode,
  ])

  if (maxScrollOffset <= 0 || viewportHeight <= 0) {
    return null
  }

  return (
    <div
      className="absolute right-0 top-12 bottom-0 z-20 w-2.5 select-none p-0.5"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) {
          return
        }

        const rect = event.currentTarget.getBoundingClientRect()
        const thumbCenter = event.clientY - rect.top - thumbHeight / 2
        const ratio = maxThumbTop > 0 ? thumbCenter / maxThumbTop : 0

        setScrollOffset(ratio * maxScrollOffset)
      }}
    >
      <div
        className="absolute left-0.5 right-0.5 rounded-xl bg-zinc-500/50 hover:bg-zinc-500/70 active:bg-zinc-500/70"
        style={{
          height: thumbHeight,
          transform: `translate3d(0, calc(var(--torrent-table-scroll-progress, 0) * ${maxThumbTop}px), 0)`,
          willChange: 'transform',
        }}
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setScrollSamplingMode('drag')
          setDragState({
            startY: event.clientY,
            startOffset: getScrollOffset(),
          })
        }}
      />
    </div>
  )
}
