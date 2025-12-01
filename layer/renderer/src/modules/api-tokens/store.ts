import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createWithEqualityFn } from 'zustand/traditional'

import type { ApiTokenSlotId } from './definitions'
import { API_TOKEN_SLOTS } from './definitions'
import type { ApiTokenSlotState, ApiTokenState } from './types'

const createDefaultSlotState = (): ApiTokenSlotState => ({
  hasValue: false,
  hint: null,
  encryption: 'plain',
  createdAt: null,
  updatedAt: null,
  isSaving: false,
  error: null,
})

const createInitialState = (): ApiTokenState => {
  const slots = Object.fromEntries(
    API_TOKEN_SLOTS.map((slot) => [slot.id, createDefaultSlotState()]),
  ) as Record<ApiTokenSlotId, ApiTokenSlotState>

  return {
    initialized: false,
    isLoading: false,
    loadError: null,
    slots,
  }
}

export const useApiTokenStore = createWithEqualityFn<ApiTokenState>()(
  subscribeWithSelector(immer(createInitialState)),
)

export const apiTokenStore = {
  getState: () => useApiTokenStore.getState(),
  setState: (
    updater: ApiTokenState | ((draft: ApiTokenState) => void),
    replace = false,
  ) => {
    if (typeof updater === 'function') {
      if (replace) {
        useApiTokenStore.setState(updater, true)
      } else {
        useApiTokenStore.setState(updater)
      }
    } else {
      useApiTokenStore.setState(updater, true)
    }
  },
  reset: () => {
    useApiTokenStore.setState(createInitialState(), true)
  },
}

export const resetApiTokenStore = apiTokenStore.reset
