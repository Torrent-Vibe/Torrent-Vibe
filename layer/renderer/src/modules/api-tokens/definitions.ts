import type { AiProviderId } from '@torrent-vibe/shared'
import { API_TOKENS } from '@torrent-vibe/shared'

export type ApiTokenGroupId = 'discover' | 'ai' | 'metadata'
export type ApiTokenSlotId =
  | 'discover.omdb.apiKey'
  | 'ai.openai.apiKey'
  | 'ai.openai.baseUrl'
  | 'ai.openai.model'
  | 'ai.openrouter.apiKey'
  | 'ai.openrouter.model'
  | 'metadata.tmdb.apiKey'

export interface ApiTokenSlotDefinition {
  id: ApiTokenSlotId
  groupId: ApiTokenGroupId
  providerId: string
  field: string
  icon: string
  labelKey: I18nKeysForSettings
  descriptionKey: I18nKeysForSettings
  placeholderKey?: I18nKeysForSettings
  docsUrl?: string
  required?: boolean
  inputType?: 'password' | 'text' | 'url'
}

export interface ApiTokenGroupDefinition {
  id: ApiTokenGroupId
  icon: string
  labelKey: I18nKeysForSettings
  descriptionKey: I18nKeysForSettings
  slots: readonly ApiTokenSlotDefinition[]
  emptyStateKey?: I18nKeysForSettings
}

export interface AiProviderDefinition {
  id: AiProviderId
  labelKey: I18nKeysForSettings
  descriptionKey?: I18nKeysForSettings
  slots: readonly ApiTokenSlotDefinition[]
  requiredSlotIds: readonly ApiTokenSlotId[]
}

const DISCOVER_SLOTS: readonly ApiTokenSlotDefinition[] = [
  {
    id: API_TOKENS.discover.omdb.apiKey,
    groupId: 'discover',
    providerId: 'omdb',
    field: 'apiKey',
    icon: 'i-mingcute-video-line',
    labelKey: 'tabs.apiTokens.slots.omdbApiKey.label',
    descriptionKey: 'tabs.apiTokens.slots.omdbApiKey.description',
    placeholderKey: 'tabs.apiTokens.slots.omdbApiKey.placeholder',
    docsUrl: 'https://www.omdbapi.com/apikey.aspx',
    required: true,
  },
] as const

const OPENAI_SLOTS: readonly ApiTokenSlotDefinition[] = [
  {
    id: API_TOKENS.ai.openai.apiKey,
    groupId: 'ai',
    providerId: 'openai',
    field: 'apiKey',
    icon: 'i-mingcute-brain-line',
    labelKey: 'tabs.apiTokens.slots.openaiApiKey.label',
    descriptionKey: 'tabs.apiTokens.slots.openaiApiKey.description',
    placeholderKey: 'tabs.apiTokens.slots.openaiApiKey.placeholder',
    docsUrl: 'https://platform.openai.com/api-keys',
    required: true,
  },
  {
    id: API_TOKENS.ai.openai.baseUrl,
    groupId: 'ai',
    providerId: 'openai',
    field: 'baseUrl',
    icon: 'i-mingcute-earth-line',
    labelKey: 'tabs.apiTokens.slots.openaiBaseUrl.label',
    descriptionKey: 'tabs.apiTokens.slots.openaiBaseUrl.description',
    placeholderKey: 'tabs.apiTokens.slots.openaiBaseUrl.placeholder',
    docsUrl: 'https://platform.openai.com/docs/api-reference#base-url',
    inputType: 'text',
  },
  {
    id: API_TOKENS.ai.openai.model,
    groupId: 'ai',
    providerId: 'openai',
    field: 'model',
    icon: 'i-mingcute-text-line',
    labelKey: 'tabs.apiTokens.slots.openaiModel.label',
    descriptionKey: 'tabs.apiTokens.slots.openaiModel.description',
    placeholderKey: 'tabs.apiTokens.slots.openaiModel.placeholder',
    inputType: 'text',
  },
] as const

const OPENROUTER_SLOTS: readonly ApiTokenSlotDefinition[] = [
  {
    id: API_TOKENS.ai.openrouter.apiKey,
    groupId: 'ai',
    providerId: 'openrouter',
    field: 'apiKey',
    icon: 'i-mingcute-brain-line',
    labelKey: 'tabs.apiTokens.slots.openrouterApiKey.label',
    descriptionKey: 'tabs.apiTokens.slots.openrouterApiKey.description',
    placeholderKey: 'tabs.apiTokens.slots.openrouterApiKey.placeholder',
    docsUrl: 'https://openrouter.ai/docs',
    required: true,
  },
  {
    id: API_TOKENS.ai.openrouter.model,
    groupId: 'ai',
    providerId: 'openrouter',
    field: 'model',
    icon: 'i-mingcute-text-line',
    labelKey: 'tabs.apiTokens.slots.openrouterModel.label',
    descriptionKey: 'tabs.apiTokens.slots.openrouterModel.description',
    placeholderKey: 'tabs.apiTokens.slots.openrouterModel.placeholder',
    inputType: 'text',
  },
] as const

export const AI_PROVIDER_DEFINITIONS: readonly AiProviderDefinition[] = [
  {
    id: 'openai',
    labelKey: 'tabs.apiTokens.providers.openai.label',
    descriptionKey: 'tabs.apiTokens.providers.openai.description',
    slots: OPENAI_SLOTS,
    requiredSlotIds: [API_TOKENS.ai.openai.apiKey],
  },
  {
    id: 'openrouter',
    labelKey: 'tabs.apiTokens.providers.openrouter.label',
    descriptionKey: 'tabs.apiTokens.providers.openrouter.description',
    slots: OPENROUTER_SLOTS,
    requiredSlotIds: [API_TOKENS.ai.openrouter.apiKey],
  },
] as const

const AI_SLOTS: readonly ApiTokenSlotDefinition[] =
  AI_PROVIDER_DEFINITIONS.flatMap((provider) => provider.slots)

const METADATA_SLOTS: readonly ApiTokenSlotDefinition[] = [
  {
    id: API_TOKENS.metadata.tmdb.apiKey,
    groupId: 'metadata',
    providerId: 'tmdb',
    field: 'apiKey',
    icon: 'i-mingcute-video-2-line',
    labelKey: 'tabs.apiTokens.slots.tmdbApiKey.label',
    descriptionKey: 'tabs.apiTokens.slots.tmdbApiKey.description',
    placeholderKey: 'tabs.apiTokens.slots.tmdbApiKey.placeholder',
    docsUrl: 'https://developer.themoviedb.org/reference/intro/getting-started',
  },
] as const

export const API_TOKEN_GROUPS: readonly ApiTokenGroupDefinition[] = [
  {
    id: 'discover',
    icon: 'i-mingcute-compass-line',
    labelKey: 'tabs.apiTokens.groups.discover.title',
    descriptionKey: 'tabs.apiTokens.groups.discover.description',
    slots: DISCOVER_SLOTS,
  },
  {
    id: 'ai',
    icon: 'i-mingcute-magic-line',
    labelKey: 'tabs.apiTokens.groups.ai.title',
    descriptionKey: 'tabs.apiTokens.groups.ai.description',
    slots: AI_SLOTS,
    emptyStateKey: 'tabs.apiTokens.groups.ai.placeholder',
  },
  {
    id: 'metadata',
    icon: 'i-mingcute-clapperboard-cut-line',
    labelKey: 'tabs.apiTokens.groups.metadata.title',
    descriptionKey: 'tabs.apiTokens.groups.metadata.description',
    slots: METADATA_SLOTS,
  },
] as const

export const API_TOKEN_SLOTS: readonly ApiTokenSlotDefinition[] =
  API_TOKEN_GROUPS.flatMap((group) => group.slots)
