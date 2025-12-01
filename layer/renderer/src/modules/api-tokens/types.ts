import type { ApiTokenSlotDefinition, ApiTokenSlotId } from './definitions'

export interface ApiTokenSlotState {
  hasValue: boolean
  hint: string | null
  encryption: 'safeStorage' | 'plain'
  createdAt: string | null
  updatedAt: string | null
  isSaving: boolean
  error: string | null
}

export interface ApiTokenState {
  initialized: boolean
  isLoading: boolean
  loadError: string | null
  slots: Record<ApiTokenSlotId, ApiTokenSlotState>
}

export interface ApiTokenSummaryDTO {
  id: string
  hint: string | null
  encryption: 'safeStorage' | 'plain'
  createdAt: string
  updatedAt: string
  hasValue: boolean
}

export interface ApiTokenSlotView extends ApiTokenSlotState {
  id: ApiTokenSlotId
  definition: ApiTokenSlotDefinition
}

export interface ApiTokenActionResult<T = void> {
  ok: boolean
  data?: T
  error?: string
}
