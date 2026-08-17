import type { ApiTokenSlotDefinition, ApiTokenSlotId } from './definitions'

export interface ApiTokenSlotState {
  createdAt: string | null
  encryption: 'safeStorage' | 'plain'
  error: string | null
  hasValue: boolean
  hint: string | null
  isSaving: boolean
  updatedAt: string | null
}

export interface ApiTokenState {
  initialized: boolean
  isLoading: boolean
  loadError: string | null
  slots: Record<ApiTokenSlotId, ApiTokenSlotState>
}

export interface ApiTokenSummaryDTO {
  createdAt: string
  encryption: 'safeStorage' | 'plain'
  hasValue: boolean
  hint: string | null
  id: string
  updatedAt: string
}

export interface ApiTokenSlotView extends ApiTokenSlotState {
  definition: ApiTokenSlotDefinition
  id: ApiTokenSlotId
}

export interface ApiTokenActionResult<T = void> {
  data?: T
  error?: string
  ok: boolean
}
