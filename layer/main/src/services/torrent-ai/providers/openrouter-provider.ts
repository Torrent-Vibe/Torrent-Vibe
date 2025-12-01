import type { OpenAIChatModelId } from '@ai-sdk/openai/internal'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { app } from 'electron'

import type { ProviderConfig } from '../types'
import type { AiProviderAdapter, AiProviderRuntime } from './types'

const ERROR_NAMESPACE = 'ai.openrouter'

const DEFAULT_REFERER = 'https://torrent-vibe.app'
const DEFAULT_TITLE = 'Torrent Vibe'

const resolveAppTitle = (): string => {
  try {
    const name = app.getName()
    return name && name.trim().length > 0 ? name : DEFAULT_TITLE
  } catch {
    return DEFAULT_TITLE
  }
}

export class OpenRouterProviderAdapter implements AiProviderAdapter {
  readonly id = 'openrouter' as const
  readonly missingCredentialError = `${ERROR_NAMESPACE}.missingApiKey`

  isConfigured(config: ProviderConfig): boolean {
    const apiKey = config.providers.openrouter.apiKey?.trim()
    return Boolean(apiKey)
  }

  resolve(config: ProviderConfig): AiProviderRuntime | null {
    if (!this.isConfigured(config)) {
      return null
    }

    const providerConfig = config.providers.openrouter
    const client = createOpenRouter({
      apiKey: providerConfig.apiKey ?? undefined,
      headers: {
        'HTTP-Referer': DEFAULT_REFERER,
        'X-Title': resolveAppTitle(),
      },
    })

    const model = client(providerConfig.model as OpenAIChatModelId)

    return {
      id: this.id,
      model,
      modelId: providerConfig.model,
      errorNamespace: ERROR_NAMESPACE,
    }
  }
}
