import { createModels } from '@earendil-works/pi-ai'
import { openrouterProvider } from '@earendil-works/pi-ai/providers/openrouter'
import { app } from 'electron'

import type { ProviderConfig } from '../types'
import {
  createCompatCollection,
  createCompatModel,
  DEFAULT_OPENROUTER_MODEL,
} from './pi-runtime'
import type { AiProviderAdapter, AiProviderRuntime } from './types'

const ERROR_NAMESPACE = 'ai.openrouter'
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_REFERER = 'https://torrent-vibe.app'
const DEFAULT_TITLE = 'Torrent Vibe'

const resolveAppTitle = (): string => {
  try {
    const name = app.getName()
    return name && name.trim().length > 0 ? name : DEFAULT_TITLE
  }
  catch {
    return DEFAULT_TITLE
  }
}

export class OpenRouterProviderAdapter implements AiProviderAdapter {
  readonly id = 'openrouter' as const
  readonly missingCredentialError = `${ERROR_NAMESPACE}.missingApiKey`

  isConfigured(config: ProviderConfig): boolean {
    return Boolean(config.providers.openrouter.apiKey?.trim())
  }

  resolve(config: ProviderConfig): AiProviderRuntime | null {
    const apiKey = config.providers.openrouter.apiKey?.trim()
    if (!apiKey) {
      return null
    }

    const modelId
      = config.providers.openrouter.model || DEFAULT_OPENROUTER_MODEL
    const models = createModels()
    models.setProvider(openrouterProvider())
    const catalogModel = models.getModel('openrouter', modelId)
    if (catalogModel) {
      return {
        id: this.id,
        model: catalogModel,
        modelId,
        models,
        apiKey,
        sessionAffinityFormat: 'openrouter',
        errorNamespace: ERROR_NAMESPACE,
      }
    }

    const model = createCompatModel({
      id: modelId,
      provider: 'openrouter',
      baseUrl: OPENROUTER_BASE_URL,
      sessionAffinityFormat: 'openrouter',
    })
    return {
      id: this.id,
      model,
      modelId,
      models: createCompatCollection('openrouter', model, OPENROUTER_BASE_URL),
      apiKey,
      sessionAffinityFormat: 'openrouter',
      errorNamespace: ERROR_NAMESPACE,
    }
  }
}

export const openRouterAppHeaders = () => ({
  'HTTP-Referer': DEFAULT_REFERER,
  'X-Title': resolveAppTitle(),
})
