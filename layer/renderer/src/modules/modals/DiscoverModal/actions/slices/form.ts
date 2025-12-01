import type { DiscoverFilterState } from '../../types'
import type { DiscoverActionContext } from '../context'

export const createFormSlice = (context: DiscoverActionContext) => {
  const updateKeyword = (keyword: string) => {
    context.setState((draft) => {
      draft.keyword = keyword
    })
  }

  const updateFilters = (
    updater:
      | DiscoverFilterState
      | ((prev: DiscoverFilterState) => DiscoverFilterState),
  ) => {
    context.setState((draft) => {
      const nextFilters =
        typeof updater === 'function'
          ? (updater as (prev: DiscoverFilterState) => DiscoverFilterState)(
              draft.filters,
            )
          : updater
      draft.filters = context.ensureFilterClone(nextFilters)
    })
  }

  const clearFiltersToDefault = () => {
    const { defaultFilters } = context.getState()
    context.setState((draft) => {
      draft.filters = context.ensureFilterClone(defaultFilters)
    })
  }

  const resetSearch = () => {
    context.setState((draft) => {
      draft.keyword = ''
      draft.filters = context.ensureFilterClone(draft.defaultFilters)
      draft.committedSearch = null
      draft.items = []
      draft.total = null
      draft.hasMore = false
      draft.isSearching = false
      draft.searchError = null
      draft.selectedIds = new Set()
      draft.previewId = null
      draft.previewDetail = null
      draft.isPreviewLoading = false
      draft.previewError = null
      draft.importing = false
      draft.totalPages = 0
      draft.total = 0
    })
  }

  return {
    updateKeyword,
    updateFilters,
    clearFiltersToDefault,
    resetSearch,
  }
}
