import type { AiProviderId } from '@torrent-vibe/shared'

import { OpenAIProviderAdapter } from './openai-provider'
import { OpenRouterProviderAdapter } from './openrouter-provider'
import type { AiProviderAdapter } from './types'

const adapters: AiProviderAdapter[] = [
  new OpenAIProviderAdapter(),
  new OpenRouterProviderAdapter(),
]

const adapterMap = new Map<AiProviderId, AiProviderAdapter>(
  adapters.map((adapter) => [adapter.id, adapter]),
)

export const getRegisteredProviders = (): readonly AiProviderAdapter[] =>
  adapters

export const getProviderById = (
  id: AiProviderId,
): AiProviderAdapter | undefined => adapterMap.get(id)
