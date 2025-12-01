import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import * as React from 'react'

import { getTorrentTableActions } from '../stores/torrent-table-store'

export const useTorrentTableDragDrop = () => {
  const actions = getTorrentTableActions()

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor),
  )

  // Column reorder via dnd-kit
  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      actions.setDragState({
        isDragging: true,
        draggedColumnId: active.id as string,
        dropZoneColumnId: null,
        dragOffset: { x: 0, y: 0 },
      })
    },
    [actions],
  )

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      actions.setDragState({
        isDragging: false,
        draggedColumnId: null,
        dropZoneColumnId: null,
        dragOffset: { x: 0, y: 0 },
      })

      if (active.id !== over?.id && over?.id) {
        const sourceId = active.id as string
        const targetId = over.id as string

        // Skip if trying to move 'select' column or move to 'select'
        if (sourceId === 'select' || targetId === 'select') return

        // Update both session and persistent state
        actions.updateColumnOrder((prev) => {
          const oldIndex = prev.indexOf(sourceId)
          const newIndex = prev.indexOf(targetId)

          if (oldIndex === -1 || newIndex === -1) return prev

          const newOrder = arrayMove(prev, oldIndex, newIndex)

          // Update persistent state (excluding 'select' column)
          const persistentOrder = newOrder.filter((id) => id !== 'select')
          actions.setOrderedColumns(persistentOrder)

          return newOrder
        })
      }
    },
    [actions],
  )

  return {
    sensors,
    handleDragStart,
    handleDragEnd,
  }
}
