export const AI_PROVIDER_IDS = ['openai', 'openrouter'] as const

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number]

export const DEFAULT_AI_PROVIDER_ORDER: readonly AiProviderId[] =
  AI_PROVIDER_IDS
