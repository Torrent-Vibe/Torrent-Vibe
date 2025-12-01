import type { DiscoverActionContext } from '../context'

export const createHistorySlice = (context: DiscoverActionContext) => {
  const clearSearchHistory = () => {
    const providerId = context.getState().activeProviderId
    if (!providerId) {
      return
    }

    context.setState((draft) => {
      draft.searchHistory = []
    })

    context.history.persist(providerId, [])
  }

  const removeSearchHistoryEntry = (value: string) => {
    const providerId = context.getState().activeProviderId
    if (!providerId) {
      return
    }

    let persistedHistory: string[] = []
    context.setState((draft) => {
      persistedHistory = draft.searchHistory.filter((item) => item !== value)
      draft.searchHistory = persistedHistory
    })

    context.history.persist(providerId, persistedHistory)
  }

  return {
    clearSearchHistory,
    removeSearchHistoryEntry,
  }
}
