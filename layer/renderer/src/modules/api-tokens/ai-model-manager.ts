import type { AiProviderId } from '@torrent-vibe/shared'
import { API_TOKENS } from '@torrent-vibe/shared'

import { ApiTokenActions } from './actions'

export interface GetModelsOptions {
  signal?: AbortSignal
}

export type AiModelFetcher = (options: GetModelsOptions) => Promise<string[]>

/**
 * Manages fetching available model lists for AI providers.
 * Extensible via registerFetcher to support additional providers.
 */
export class AiModelManager {
  private static instance: AiModelManager | null = null

  static getInstance(): AiModelManager {
    if (!this.instance) this.instance = new AiModelManager()
    return this.instance
  }

  private readonly fetchers = new Map<AiProviderId, AiModelFetcher>()

  private constructor() {
    this.fetchers.set('openai', this.fetchOpenAIModels)
    this.fetchers.set('openrouter', this.fetchOpenRouterModels)
  }

  registerFetcher(providerId: AiProviderId, fetcher: AiModelFetcher): void {
    this.fetchers.set(providerId, fetcher)
  }

  async getModels(
    providerId: AiProviderId,
    options: GetModelsOptions = {},
  ): Promise<string[]> {
    const fetcher = this.fetchers.get(providerId)
    if (!fetcher) {
      return []
    }
    return await fetcher.call(this, options)
  }

  // --- Built-in fetchers ---

  private async fetchOpenAIModels({
    signal,
  }: GetModelsOptions): Promise<string[]> {
    const [apiKey, baseUrl] = await Promise.all([
      ApiTokenActions.shared.getTokenValue(API_TOKENS.ai.openai.apiKey),
      ApiTokenActions.shared.getTokenValue(API_TOKENS.ai.openai.baseUrl),
    ])

    const key = (apiKey ?? '').trim()
    if (!key) return []

    const normalizedBaseUrl =
      (baseUrl ?? '').trim() || 'https://api.openai.com/v1'
    const url = `${normalizedBaseUrl.replaceAll(/\/+$/g, '')}/models`

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${key.replace(/^Bearer\s+/i, '')}`,
        Accept: 'application/json',
      },
      signal,
    })
    if (!res.ok) {
      // Swallow model listing errors; caller can surface generic error if needed
      return []
    }

    type OpenAIModelEntry = { id?: string | null } | null | undefined
    type OpenAIModelList = { data?: OpenAIModelEntry[] | null } | null
    const json = (await res.json()) as OpenAIModelList
    const ids: string[] = Array.isArray(json?.data)
      ? (json!
          .data!.map((m) => (m && typeof m.id === 'string' ? m.id : null))
          .filter(Boolean) as string[])
      : []
    ids.sort((a, b) => a?.localeCompare(b ?? '') ?? 0)
    return ids
  }

  private async fetchOpenRouterModels({
    signal,
  }: GetModelsOptions): Promise<string[]> {
    const apiKey = await ApiTokenActions.shared.getTokenValue(
      API_TOKENS.ai.openrouter.apiKey,
    )
    const key = (apiKey ?? '').trim()
    if (!key) return []

    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${key.replace(/^Bearer\s+/i, '')}`,
        Accept: 'application/json',
        'HTTP-Referer': 'https://torrent-vibe.app',
        'X-Title': 'Torrent Vibe',
      },
      signal,
    })
    if (!res.ok) {
      return []
    }
    type OpenRouterModelEntry = { id?: string | null } | null | undefined
    type OpenRouterModelList = { data?: OpenRouterModelEntry[] | null } | null
    const json = (await res.json()) as OpenRouterModelList
    const ids: string[] = Array.isArray(json?.data)
      ? (json!
          .data!.map((m) => (m && typeof m.id === 'string' ? m.id : null))
          .filter(Boolean) as string[])
      : []
    ids.sort((a, b) => a?.localeCompare(b ?? '') ?? 0)
    return ids
  }
}

export const aiModelManager = AiModelManager.getInstance()
