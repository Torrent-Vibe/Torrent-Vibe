import type { Model, SessionAffinityFormat } from '@earendil-works/pi-ai'
import { createModels, createProvider } from '@earendil-works/pi-ai'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'

export const DEFAULT_OPENAI_MODEL = 'gpt-5-nano'
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/auto'
export const DEFAULT_CODEX_MODEL = 'gpt-5.3-codex-spark'

export function createCompatModel(input: {
  id: string
  provider: string
  baseUrl: string
  sessionAffinityFormat: SessionAffinityFormat
}): Model<'openai-completions'> {
  return {
    id: input.id,
    name: input.id,
    api: 'openai-completions',
    provider: input.provider,
    baseUrl: input.baseUrl,
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 16_384,
    compat: {
      sendSessionAffinityHeaders: true,
      sessionAffinityFormat: input.sessionAffinityFormat,
      supportsDeveloperRole: false,
    },
  }
}

export function createCompatCollection(
  providerId: string,
  model: Model<'openai-completions'>,
  baseUrl: string,
) {
  const models = createModels()
  models.setProvider(
    createProvider({
      id: providerId,
      name: providerId,
      baseUrl,
      auth: {
        apiKey: {
          name: providerId,
          resolve: async () => ({ auth: {} }),
        },
      },
      models: [model],
      api: openAICompletionsApi(),
    }),
  )
  return models
}
