import { API_TOKENS } from '@torrent-vibe/shared'

import { ApiTokenStore } from '../api-token-store'
import { AppSettingsStore } from '../app-settings-store'
import {
  DEFAULT_CODEX_MODEL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENROUTER_MODEL,
} from './providers/pi-runtime'
import type { ProviderConfig } from './types'

export const resolveAiProviderConfig = (): ProviderConfig => {
  const tokenStore = ApiTokenStore.getInstance()
  const appSettingsStore = AppSettingsStore.getInstance()

  return {
    providers: {
      openai: {
        apiKey:
          tokenStore.getTokenValue(API_TOKENS.ai.openai.apiKey)?.trim() || null,
        model:
          tokenStore.getTokenValue(API_TOKENS.ai.openai.model)?.trim() ||
          DEFAULT_OPENAI_MODEL,
        baseUrl:
          tokenStore.getTokenValue(API_TOKENS.ai.openai.baseUrl)?.trim() ||
          null,
      },
      openrouter: {
        apiKey:
          tokenStore.getTokenValue(API_TOKENS.ai.openrouter.apiKey)?.trim() ||
          null,
        model:
          tokenStore.getTokenValue(API_TOKENS.ai.openrouter.model)?.trim() ||
          DEFAULT_OPENROUTER_MODEL,
      },
      codex: {
        model:
          tokenStore.getTokenValue(API_TOKENS.ai.codex.model)?.trim() ||
          DEFAULT_CODEX_MODEL,
      },
    },
    preferredProviders: appSettingsStore.getPreferredAiProviders(),
    tmdbApiKey:
      tokenStore.getTokenValue(API_TOKENS.metadata.tmdb.apiKey)?.trim() || null,
  }
}
