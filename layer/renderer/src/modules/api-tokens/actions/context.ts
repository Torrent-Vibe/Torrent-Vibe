import { apiTokenStore } from '../store'
import type { ApiTokenState } from '../types'

export interface ApiTokenActionContext {
  getState: () => ApiTokenState
  setState: (
    updater: ApiTokenState | ((draft: ApiTokenState) => void),
    replace?: boolean,
  ) => void
}

export const createActionContext = (): ApiTokenActionContext => ({
  getState: apiTokenStore.getState,
  setState: apiTokenStore.setState,
})
