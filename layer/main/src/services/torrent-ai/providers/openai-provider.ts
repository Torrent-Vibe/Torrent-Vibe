import { createOpenAI } from '@ai-sdk/openai'
import type { OpenAIChatModelId } from '@ai-sdk/openai/internal'

import type { ProviderConfig } from '../types'
import type { AiProviderAdapter, AiProviderRuntime } from './types'

const ERROR_NAMESPACE = 'ai.openai'

export class OpenAIProviderAdapter implements AiProviderAdapter {
  readonly id = 'openai' as const
  readonly missingCredentialError = `${ERROR_NAMESPACE}.missingApiKey`

  isConfigured(config: ProviderConfig): boolean {
    const apiKey = config.providers.openai.apiKey?.trim()
    return Boolean(apiKey)
  }

  resolve(config: ProviderConfig): AiProviderRuntime | null {
    if (!this.isConfigured(config)) {
      return null
    }

    const providerConfig = config.providers.openai
    const client = createOpenAI({
      apiKey: providerConfig.apiKey ?? undefined,
      baseURL: providerConfig.baseUrl || undefined,
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
