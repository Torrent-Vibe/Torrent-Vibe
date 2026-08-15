export const AI_PROVIDER_IDS = ['openai', 'openrouter', 'codex'] as const

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number]

export const DEFAULT_AI_PROVIDER_ORDER: readonly AiProviderId[]
  = AI_PROVIDER_IDS

export const SEARCH_PROVIDER_IDS = ['codex'] as const

export type SearchProviderId = (typeof SEARCH_PROVIDER_IDS)[number]

export const DEFAULT_SEARCH_PROVIDER: SearchProviderId = 'codex'
