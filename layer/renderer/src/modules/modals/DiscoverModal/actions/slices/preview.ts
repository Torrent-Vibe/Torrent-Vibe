import { DiscoverService } from '~/modules/discover/service'

import type { DiscoverActionContext } from '../context'
import { findItemById } from '../utils'

export const createPreviewSlice = (context: DiscoverActionContext) => {
  const loadPreview = async (id: string) => {
    const state = context.getState()
    if (!state.providerReady) return

    const requestId = context.preview.nextToken()

    context.setState((draft) => {
      if (draft.previewId === id) {
        draft.isPreviewLoading = true
        draft.previewError = null
      }
    })

    try {
      const detail = await DiscoverService.detail(state.activeProviderId, {
        id,
        item: findItemById(state.items, id),
      })

      if (requestId !== context.preview.currentToken()) {
        return
      }

      context.setState((draft) => {
        if (draft.previewId === id) {
          draft.previewDetail = detail
          draft.isPreviewLoading = false
          draft.previewError = null
        }
      })
    } catch (error) {
      console.error(error)
      if (requestId !== context.preview.currentToken()) {
        return
      }

      context.setState((draft) => {
        if (draft.previewId === id) {
          draft.isPreviewLoading = false
          draft.previewError = 'requestFailed'
        }
      })
    }
  }

  const setPreview = (id: string | null) => {
    const state = context.getState()
    if (state.previewId === id) {
      if (id) {
        void loadPreview(id)
      }
      return
    }

    context.setState((draft) => {
      draft.previewId = id
      draft.previewError = null
      draft.previewDetail = id ? (findItemById(draft.items, id) ?? null) : null
      draft.isPreviewLoading = Boolean(id)
    })

    if (id) {
      void loadPreview(id)
    }
  }

  const closePreview = () => {
    context.setState((draft) => {
      draft.previewId = null
      draft.previewDetail = null
      draft.previewError = null
      draft.isPreviewLoading = false
    })
  }

  return {
    setPreview,
    closePreview,
  }
}
