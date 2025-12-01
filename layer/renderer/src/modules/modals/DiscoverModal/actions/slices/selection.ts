import type { DiscoverActionContext } from '../context'

interface SelectionSliceDependencies {
  preview: {
    setPreview: (id: string | null) => void
    closePreview: () => void
  }
}

export const createSelectionSlice = (
  context: DiscoverActionContext,
  deps: SelectionSliceDependencies,
) => {
  const toggleSelection = (id: string) => {
    let nextPreview: string | null | undefined

    context.setState((draft) => {
      const next = new Set(draft.selectedIds)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      draft.selectedIds = next

      if (next.has(id)) {
        nextPreview = id
      } else if (draft.previewId === id) {
        nextPreview = next.values().next().value ?? null
      }
    })

    if (nextPreview !== undefined) {
      deps.preview.setPreview(nextPreview)
    }
  }

  const selectAll = () => {
    const { items, selectedIds } = context.getState()
    const shouldClear = selectedIds.size === items.length

    context.setState((draft) => {
      if (shouldClear) {
        draft.selectedIds = new Set()
        return
      }

      draft.selectedIds = new Set(items.map((item) => item.id))
    })

    if (!shouldClear) {
      deps.preview.setPreview(items[0]?.id ?? null)
    } else {
      deps.preview.closePreview()
    }
  }

  const clearSelection = () => {
    context.setState((draft) => {
      draft.selectedIds = new Set()
    })
    deps.preview.closePreview()
  }

  return {
    toggleSelection,
    selectAll,
    clearSelection,
  }
}
