import type { DiscoverProviderId } from '~/atoms/settings/discover'

import type { DiscoverActionContext } from '../context'
import type { ConfigureProviderOptions } from '../types'

export const createProviderSlice = (context: DiscoverActionContext) => {
  const configureProvider = (options: ConfigureProviderOptions) => {
    context.search.invalidate()
    context.preview.invalidate()

    const persistedHistory = context.history.load(options.providerId)

    context.setState((draft) => {
      draft.activeProviderId = options.providerId
      draft.providerReady = options.providerReady
      draft.pageSize = options.pageSize
      draft.previewDescriptionRenderer = options.descriptionRenderer
      draft.filterDefinitions = [...options.filterDefinitions]
      draft.defaultFilters = context.ensureFilterClone(options.defaultFilters)
      draft.filters = context.ensureFilterClone(options.defaultFilters)
      draft.keyword = options.initialKeyword ?? ''
      draft.searchHistory = persistedHistory
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
      draft.total = null
    })
  }

  const setActiveProviderId = (providerId: DiscoverProviderId) => {
    const history = context.history.load(providerId)
    context.setState((draft) => {
      draft.activeProviderId = providerId
      draft.searchHistory = history
    })
  }

  const updateProviderMeta = (meta: {
    providerId: DiscoverProviderId
    providerReady: boolean
    pageSize: number
    descriptionRenderer?: ConfigureProviderOptions['descriptionRenderer']
  }) => {
    context.setState((draft) => {
      if (draft.activeProviderId !== meta.providerId) return
      draft.providerReady = meta.providerReady
      draft.pageSize = meta.pageSize
      if (meta.descriptionRenderer) {
        draft.previewDescriptionRenderer = meta.descriptionRenderer
      }
    })
  }

  return {
    configureProvider,
    setActiveProviderId,
    updateProviderMeta,
  }
}
