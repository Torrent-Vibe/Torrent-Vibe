import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ColumnDef, Header } from '@tanstack/react-table'
import { flexRender } from '@tanstack/react-table'
import * as React from 'react'

import { cn } from '~/lib/cn'
import type { TorrentInfo } from '~/types'

import { getAllColumns } from '../constants'
import type { TorrentTableColumnMenu } from '../hooks/use-torrent-table-column-menu'
import { useTorrentTableSelectors } from '../stores/torrent-table-store'
import type { TorrentTableConfig } from '../TorrentTableList'

interface SortableHeaderProps {
  header: Header<TorrentInfo, unknown>
  colId: string
  colDef: ColumnDef<TorrentInfo>
  isReorderable: boolean
  onContextMenu: (e: React.MouseEvent) => void
  stickyLeft?: number
}

const SortableHeaderCell: React.FC<SortableHeaderProps> = ({
  header,
  colId,
  colDef,
  isReorderable,
  onContextMenu,
  stickyLeft,
}) => {
  const [isResizing, setIsResizing] = React.useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: colId,
    disabled: !isReorderable || isResizing,
  })

  const baseStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 'auto',
    // backdropFilter: 'blur(30px) brightness(1.02)',
  }
  const stickyStyle: React.CSSProperties | undefined =
    typeof stickyLeft === 'number'
      ? {
          position: 'sticky',
          left: stickyLeft,
          zIndex: 5,
          background: 'var(--color-background)',
        }
      : undefined

  const handleResizeStart = React.useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation()
      e.preventDefault()
      setIsResizing(true)

      const handler = header.getResizeHandler()
      handler(e as unknown as Event)

      // Listen for mouse/touch end to reset resizing state
      const cleanup = () => {
        setIsResizing(false)
        document.removeEventListener('mouseup', cleanup)
        document.removeEventListener('touchend', cleanup)
      }

      document.addEventListener('mouseup', cleanup)
      document.addEventListener('touchend', cleanup)
    },
    [header],
  )

  // Custom drag handlers that check for resize zone
  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as Element
      // Don't start drag if clicking on resize handle
      if (target.closest('[data-resizer="true"]')) {
        return
      }

      if (isReorderable && !isResizing && listeners?.onPointerDown) {
        listeners.onPointerDown(e)
      }
    },
    [isReorderable, isResizing, listeners],
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (isReorderable && !isResizing && listeners?.onKeyDown) {
        listeners.onKeyDown(e)
      }
    },
    [isReorderable, isResizing, listeners],
  )

  return (
    <div
      ref={setNodeRef}
      style={{ ...baseStyle, ...stickyStyle }}
      className={cn(
        'relative h-12 select-none border-r last:border-r-0 border-border transition-all duration-200',
        isReorderable && !isResizing
          ? 'cursor-grab active:cursor-grabbing'
          : '',
        isDragging ? 'shadow-lg bg-accent/10' : '',
        isOver && !isDragging ? 'bg-accent/20 border-accent/50' : '',
      )}
      onContextMenu={onContextMenu}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      {...(isReorderable && !isResizing ? attributes : {})}
    >
      {/* Drop indicator */}
      {isOver && !isDragging && (
        <div className="absolute left-0 top-0 w-1 h-full bg-accent animate-pulse" />
      )}

      {header.isPlaceholder ? null : (
        <div
          className={`absolute inset-0 transition-all duration-200 ${
            isDragging ? 'scale-95' : 'scale-100'
          }`}
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
        </div>
      )}

      {colDef.enableResizing ? (
        <div
          data-resizer="true"
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          className="absolute top-0 right-[-2px] h-full w-[4px] z-[1] cursor-col-resize hover:bg-accent/40 hover:backdrop-blur-3xl active:bg-accent transition-colors duration-200"
        />
      ) : null}
    </div>
  )
}

interface TableHeaderProps extends TorrentTableConfig {
  columnMenu: TorrentTableColumnMenu
}

export const TableHeader: React.FC<TableHeaderProps> = ({
  columnMenu,
  ...tableConfig
}) => {
  const { table, gridTemplateColumns, minTableWidth } = tableConfig
  const { columnOffsets } = tableConfig
  const columnOrder = useTorrentTableSelectors.useColumnOrder()
  const { openColumnsMenu } = columnMenu

  return (
    <div
      className="sticky top-0 z-10 border-b border-border bg-background"
      style={{ minWidth: minTableWidth, width: '100%' }}
    >
      {table.getHeaderGroups().map((headerGroup) => (
        <SortableContext
          key={headerGroup.id}
          items={columnOrder}
          strategy={horizontalListSortingStrategy}
        >
          <div
            onContextMenu={openColumnsMenu}
            className="grid"
            style={{ gridTemplateColumns }}
          >
            {headerGroup.headers.map((header) => {
              const colId = header.column.id
              const allColumns = getAllColumns()
              const colDef = allColumns.find((c) => c.id === colId)
              if (!colDef) return null
              const isReorderable = colId !== 'select'
              const isSticky = colId === 'name' || colId === 'select'
              return (
                <SortableHeaderCell
                  key={header.id}
                  header={header}
                  colId={colId}
                  colDef={colDef}
                  isReorderable={isReorderable}
                  onContextMenu={openColumnsMenu}
                  stickyLeft={
                    isSticky ? (columnOffsets[colId] ?? 0) : undefined
                  }
                />
              )
            })}
          </div>
        </SortableContext>
      ))}
    </div>
  )
}
