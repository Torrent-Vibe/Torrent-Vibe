export type ApiTokenSlotId =
  | 'discover.omdb.apiKey'
  | 'ai.openai.apiKey'
  | 'ai.openai.baseUrl'
  | 'ai.openai.model'
  | 'ai.openrouter.apiKey'
  | 'ai.openrouter.model'
  | 'metadata.tmdb.apiKey'

export const API_TOKENS = {
  discover: {
    omdb: {
      apiKey: 'discover.omdb.apiKey' as const,
    },
  },
  ai: {
    openai: {
      apiKey: 'ai.openai.apiKey' as const,
      baseUrl: 'ai.openai.baseUrl' as const,
      model: 'ai.openai.model' as const,
    },
    openrouter: {
      apiKey: 'ai.openrouter.apiKey' as const,
      model: 'ai.openrouter.model' as const,
    },
  },
  metadata: {
    tmdb: {
      apiKey: 'metadata.tmdb.apiKey' as const,
    },
  },
} as const

export type ApiTokenKey =
  | typeof API_TOKENS.discover.omdb.apiKey
  | typeof API_TOKENS.ai.openai.apiKey
  | typeof API_TOKENS.ai.openai.baseUrl
  | typeof API_TOKENS.ai.openai.model
  | typeof API_TOKENS.ai.openrouter.apiKey
  | typeof API_TOKENS.ai.openrouter.model
  | typeof API_TOKENS.metadata.tmdb.apiKey
