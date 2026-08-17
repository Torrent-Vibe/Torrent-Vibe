import type {
  Model,
  Models,
  SessionAffinityFormat,
} from '@earendil-works/pi-ai'
import type { AiProviderId } from '@torrent-vibe/shared'

import type { ProviderConfig } from '../types'

export interface AiProviderRuntime {
  apiKey?: string
  errorNamespace: `ai.${string}`
  id: AiProviderId
  model: Model<string>
  modelId: string
  models: Models
  sessionAffinityFormat: SessionAffinityFormat
}

export interface AiProviderAdapter {
  readonly id: AiProviderId
  isConfigured: (config: ProviderConfig) => boolean
  readonly missingCredentialError: string
  resolve: (config: ProviderConfig) => AiProviderRuntime | null
}
