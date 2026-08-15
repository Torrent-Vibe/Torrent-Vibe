import type {
  Model,
  Models,
  SessionAffinityFormat,
} from '@earendil-works/pi-ai'
import type { AiProviderId } from '@torrent-vibe/shared'

import type { ProviderConfig } from '../types'

export interface AiProviderRuntime {
  id: AiProviderId
  model: Model<string>
  modelId: string
  models: Models
  apiKey?: string
  sessionAffinityFormat: SessionAffinityFormat
  errorNamespace: `ai.${string}`
}

export interface AiProviderAdapter {
  readonly id: AiProviderId
  readonly missingCredentialError: string
  isConfigured: (config: ProviderConfig) => boolean
  resolve: (config: ProviderConfig) => AiProviderRuntime | null
}
