import type { AiProviderId } from '@torrent-vibe/shared'
import type { LanguageModel } from 'ai'

import type { ProviderConfig } from '../types'

export interface AiProviderRuntime {
  id: AiProviderId
  model: LanguageModel
  modelId: string
  errorNamespace: `ai.${string}`
}

export interface AiProviderAdapter {
  readonly id: AiProviderId
  readonly missingCredentialError: string
  isConfigured: (config: ProviderConfig) => boolean
  resolve: (config: ProviderConfig) => AiProviderRuntime | null
}
