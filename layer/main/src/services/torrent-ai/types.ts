import type {
  AiProviderId,
  TorrentAIEnrichmentResult,
  TorrentAIMetadata,
} from '@torrent-vibe/shared'

export interface AnalyzeTorrentNameOptions {
  rawName: string
  hash?: string
  forceRefresh?: boolean
  /**
   * Optional simplified file list for additional context in AI analysis.
   * Provide relative paths (as shown in client) and sizes in bytes when available.
   */
  fileList?: Array<{ path: string; size?: number }>
}

export interface OpenAIProviderConfig {
  apiKey: string | null
  model: string
  baseUrl: string | null
}

export interface OpenRouterProviderConfig {
  apiKey: string | null
  model: string
}

export interface ProviderConfig {
  providers: {
    openai: OpenAIProviderConfig
    openrouter: OpenRouterProviderConfig
  }
  preferredProviders: AiProviderId[]
  tmdbApiKey: string | null
}

export interface TorrentAiEngineContract {
  analyzeName: (
    options: AnalyzeTorrentNameOptions,
  ) => Promise<TorrentAIEnrichmentResult>
  clearCache: () => Promise<void>
}

export type TorrentAiCacheValue = {
  metadata: TorrentAIMetadata
  createdAt: number
}

export type TorrentAiCacheKey = string
