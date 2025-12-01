import { DiscoverService } from '~/modules/discover/service'

import type { DiscoverActionContext } from '../context'
import { SEARCH_HISTORY_LIMIT } from '../context'
import type { ActionResult } from '../types'

interface SearchSliceDependencies {
  preview: {
    setPreview: (id: string | null) => void
  }
}

export const createSearchSlice = (
  context: DiscoverActionContext,
  deps: SearchSliceDependencies,
) => {
  const recordSearchKeyword = (keyword: string) => {
    const normalized = keyword.trim()
    if (!normalized) {
      return
    }

    const providerId = context.getState().activeProviderId
    if (!providerId) {
      return
    }

    let persistedHistory: string[] = []
    context.setState((draft) => {
      const nextHistory = draft.searchHistory.filter(
        (item) => item !== normalized,
      )
      nextHistory.unshift(normalized)
      persistedHistory = nextHistory.slice(0, SEARCH_HISTORY_LIMIT)
      draft.searchHistory = persistedHistory
    })

    context.history.persist(providerId, persistedHistory)
  }

  const buildCommittedSearch = () => {
    const state = context.getState()
    return {
      keyword: state.keyword.trim(),
      filters: context.ensureFilterClone(state.filters),
      page: 1,
    }
  }

  const fetchPage = async (committed: {
    keyword: string
    filters: Record<string, unknown>
    page: number
  }): Promise<ActionResult> => {
    const stateBeforeFetch = context.getState()
    const providerId = stateBeforeFetch.activeProviderId
    const requestId = context.search.nextToken()

    try {
      const response = await DiscoverService.search(providerId, {
        keyword: committed.keyword,
        filters: committed.filters,
        page: committed.page,
        pageSize: stateBeforeFetch.pageSize,
      })

      if (requestId !== context.search.currentToken()) {
        return { ok: false, error: 'staleSearch' }
      }

      let nextPreview: string | null | undefined

      context.setState((draft) => {
        draft.items = response.items
        draft.total = response.total ?? response.items.length
        draft.totalPages = response.totalPages ?? 0
        draft.hasMore = Boolean(response.hasMore)
        draft.isSearching = false
        draft.searchError = null
        draft.committedSearch = {
          keyword: committed.keyword,
          filters: context.ensureFilterClone(committed.filters),
          page: response.page ?? committed.page,
        }

        const validIds = new Set(response.items.map((item) => item.id))
        const nextSelected = new Set(
          Array.from(draft.selectedIds).filter((id) => validIds.has(id)),
        )
        draft.selectedIds = nextSelected

        if (draft.previewId && !validIds.has(draft.previewId)) {
          nextPreview = nextSelected.values().next().value ?? null
          draft.previewId = nextPreview
          draft.previewDetail = null
          draft.previewError = null
        }
      })

      if (nextPreview !== undefined) {
        deps.preview.setPreview(nextPreview)
      }

      return { ok: true }
    } catch (error) {
      console.error(error)
      if (requestId !== context.search.currentToken()) {
        return { ok: false, error: 'staleSearch' }
      }

      context.setState((draft) => {
        draft.isSearching = false
        draft.searchError = 'requestFailed'
      })
      return { ok: false, error: 'requestFailed' }
    }
  }

  const performSearch = async (): Promise<ActionResult> => {
    const snapshot = context.getState()
    if (!snapshot.providerReady) {
      context.setState((draft) => {
        draft.searchError = 'providerNotReady'
      })
      return { ok: false, error: 'providerNotReady' }
    }

    const committed = buildCommittedSearch()
    recordSearchKeyword(committed.keyword)

    context.setState((draft) => {
      draft.committedSearch = committed
      draft.isSearching = true
      draft.searchError = null
    })

    return fetchPage(committed)
  }

  const goToPage = async (page: number): Promise<ActionResult> => {
    const snapshot = context.getState()
    if (!snapshot.committedSearch) {
      return { ok: false, error: 'noCommittedSearch' }
    }

    const committed = {
      ...snapshot.committedSearch,
      page,
    }

    context.setState((draft) => {
      draft.committedSearch = committed
      draft.isSearching = true
      draft.searchError = null
    })

    return fetchPage(committed)
  }

  return {
    performSearch,
    goToPage,
  }
}
