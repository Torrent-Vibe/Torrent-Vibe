import { createModels } from '@earendil-works/pi-ai'
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai'

import type { ProviderConfig } from '../types'
import {
  createCompatCollection,
  createCompatModel,
  DEFAULT_OPENAI_MODEL,
} from './pi-runtime'
import type { AiProviderAdapter, AiProviderRuntime } from './types'

const ERROR_NAMESPACE = 'ai.openai'
const OPENAI_BASE_URL = 'https://api.openai.com/v1'

export class OpenAIProviderAdapter implements AiProviderAdapter {
  readonly id = 'openai' as const
  readonly missingCredentialError = `${ERROR_NAMESPACE}.missingApiKey`

  isConfigured(config: ProviderConfig): boolean {
    return Boolean(config.providers.openai.apiKey?.trim())
  }

  resolve(config: ProviderConfig): AiProviderRuntime | null {
    const apiKey = config.providers.openai.apiKey?.trim()
    if (!apiKey) {
      return null
    }

    const modelId = config.providers.openai.model || DEFAULT_OPENAI_MODEL
    const baseUrl = config.providers.openai.baseUrl?.trim() || OPENAI_BASE_URL

    if (!config.providers.openai.baseUrl?.trim()) {
      const models = createModels()
      models.setProvider(openaiProvider())
      const catalogModel = models.getModel('openai', modelId)
      if (catalogModel) {
        return {
          id: this.id,
          model: catalogModel,
          modelId,
          models,
          apiKey,
          sessionAffinityFormat: 'openai',
          errorNamespace: ERROR_NAMESPACE,
        }
      }
    }

    const model = createCompatModel({
      id: modelId,
      provider: 'openai',
      baseUrl,
      sessionAffinityFormat: 'openai',
    })
    return {
      id: this.id,
      model,
      modelId,
      models: createCompatCollection('openai', model, baseUrl),
      apiKey,
      sessionAffinityFormat: 'openai',
      errorNamespace: ERROR_NAMESPACE,
    }
  }
}
