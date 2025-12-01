import { ipcServices } from '~/lib/ipc-client'

import type { ApiTokenSlotId } from '../../definitions'
import { API_TOKEN_SLOTS } from '../../definitions'
import type { ApiTokenActionResult, ApiTokenSummaryDTO } from '../../types'
import type { ApiTokenActionContext } from '../context'

const isElectronEnvironment = typeof ELECTRON !== 'undefined' && ELECTRON

type ApiTokensService = NonNullable<typeof ipcServices>['apiTokens']

type SupportResult =
  | { ok: true; service: ApiTokensService }
  | { ok: false; error: string }

const updateSlotFromSummary = (
  context: ApiTokenActionContext,
  summary: ApiTokenSummaryDTO,
) => {
  context.setState((draft) => {
    const slot = draft.slots[summary.id as ApiTokenSlotId]
    if (!slot) return

    slot.hasValue = summary.hasValue
    slot.hint = summary.hint
    slot.encryption = summary.encryption
    slot.createdAt = summary.createdAt
    slot.updatedAt = summary.updatedAt
    slot.isSaving = false
    slot.error = null
  })
}

export const createManageSlice = (context: ApiTokenActionContext) => {
  const ensureSupported = (): SupportResult => {
    if (!isElectronEnvironment) {
      return { ok: false, error: 'notSupported' }
    }

    const service = ipcServices?.apiTokens as ApiTokensService | undefined
    if (!service) {
      return { ok: false, error: 'notSupported' }
    }

    return { ok: true, service }
  }

  const bootstrap = async (): Promise<ApiTokenActionResult> => {
    const support = ensureSupported()
    if (!support.ok) {
      context.setState((draft) => {
        draft.initialized = true
        draft.isLoading = false
        draft.loadError = support.error ?? null
      })
      return { ok: false, error: support.error ?? 'notSupported' }
    }

    context.setState((draft) => {
      draft.isLoading = true
      draft.loadError = null
    })

    try {
      const summaries = await support.service.listSlots()
      if (Array.isArray(summaries)) {
        context.setState((draft) => {
          for (const summary of summaries) {
            const slot = draft.slots[summary.id as ApiTokenSlotId]
            if (!slot) continue
            slot.hasValue = summary.hasValue
            slot.hint = summary.hint
            slot.encryption = summary.encryption
            slot.createdAt = summary.createdAt
            slot.updatedAt = summary.updatedAt
            slot.isSaving = false
            slot.error = null
          }
          draft.initialized = true
          draft.isLoading = false
        })
      } else {
        context.setState((draft) => {
          draft.initialized = true
          draft.isLoading = false
        })
      }
      return { ok: true }
    } catch (error) {
      console.error('[api-tokens] failed to load tokens', error)
      context.setState((draft) => {
        draft.isLoading = false
        draft.initialized = true
        draft.loadError = 'loadFailed'
      })
      return { ok: false, error: 'loadFailed' }
    }
  }

  const setTokenValue = async (
    id: ApiTokenSlotId,
    value: string,
  ): Promise<ApiTokenActionResult<ApiTokenSummaryDTO>> => {
    const support = ensureSupported()

    if (!support.ok) {
      context.setState((draft) => {
        const slot = draft.slots[id]
        if (slot) {
          slot.error = support.error ?? 'notSupported'
        }
      })
      return { ok: false, error: support.error ?? 'notSupported' }
    }

    context.setState((draft) => {
      const slot = draft.slots[id]
      if (slot) {
        slot.isSaving = true
        slot.error = null
      }
    })

    try {
      const { service } = support
      const def = API_TOKEN_SLOTS.find((s) => s.id === id)
      const encryption: 'safeStorage' | 'plain' =
        def?.inputType === 'password' || !def?.inputType
          ? 'safeStorage'
          : 'plain'
      const summary = await service.setValue({ id, value, encryption })
      updateSlotFromSummary(context, summary)
      return { ok: true, data: summary }
    } catch (error) {
      console.error('[api-tokens] failed to set token', { id, error })
      context.setState((draft) => {
        const slot = draft.slots[id]
        if (slot) {
          slot.isSaving = false
          slot.error = 'saveFailed'
        }
      })
      return { ok: false, error: 'saveFailed' }
    }
  }

  const clearTokenValue = async (
    id: ApiTokenSlotId,
  ): Promise<ApiTokenActionResult<ApiTokenSummaryDTO>> => {
    const support = ensureSupported()
    if (!support.ok) {
      context.setState((draft) => {
        const slot = draft.slots[id]
        if (slot) {
          slot.error = support.error ?? 'notSupported'
        }
      })
      return { ok: false, error: support.error ?? 'notSupported' }
    }

    context.setState((draft) => {
      const slot = draft.slots[id]
      if (slot) {
        slot.isSaving = true
        slot.error = null
      }
    })

    try {
      const { service } = support
      const summary = await service.clearValue(id)
      context.setState((draft) => {
        const slot = draft.slots[id]
        if (slot) {
          slot.hasValue = false
          slot.hint = null
          slot.updatedAt = summary.updatedAt
          slot.encryption = summary.encryption
          slot.isSaving = false
          slot.error = null
        }
      })
      return { ok: true, data: summary }
    } catch (error) {
      console.error('[api-tokens] failed to clear token', { id, error })
      context.setState((draft) => {
        const slot = draft.slots[id]
        if (slot) {
          slot.isSaving = false
          slot.error = 'clearFailed'
        }
      })
      return { ok: false, error: 'clearFailed' }
    }
  }

  const getTokenValue = async (id: ApiTokenSlotId): Promise<string | null> => {
    const support = ensureSupported()
    if (!support.ok) {
      return null
    }

    try {
      const { service } = support
      const value = await service.getValue(id)
      return typeof value === 'string' && value.trim() ? value.trim() : null
    } catch (error) {
      console.error('[api-tokens] failed to retrieve token value', {
        id,
        error,
      })
      return null
    }
  }

  return {
    bootstrap,
    setTokenValue,
    clearTokenValue,
    getTokenValue,
  }
}
