import type {
  AiProviderId,
  TorrentAIEnrichmentResult,
  TorrentAIMetadata,
} from '@torrent-vibe/shared'

export interface AnalyzeTorrentNameOptions {
  /**
   * Optional simplified file list for additional context in AI analysis.
   * Provide relative paths (as shown in client) and sizes in bytes when available.
   */
  fileList?: Array<{ path: string; size?: number }>
  forceRefresh?: boolean
  hash?: string
  rawName: string
}

export interface OpenAIProviderConfig {
  apiKey: string | null
  baseUrl: string | null
  model: string
}

export interface OpenRouterProviderConfig {
  apiKey: string | null
  model: string
}

export interface CodexProviderConfig {
  model: string
}

export interface ProviderConfig {
  preferredProviders: AiProviderId[]
  providers: {
    openai: OpenAIProviderConfig
    openrouter: OpenRouterProviderConfig
    codex: CodexProviderConfig
  }
  tmdbApiKey: string | null
}

export interface TorrentAiEngineContract {
  analyzeName: (
    options: AnalyzeTorrentNameOptions,
  ) => Promise<TorrentAIEnrichmentResult>
  clearCache: () => Promise<void>
  lookupCached: (options: {
    rawName: string
    hash?: string
  }) => Promise<TorrentAIEnrichmentResult>
}

export type TorrentAiCacheValue = {
  metadata: TorrentAIMetadata
  createdAt: number
}

export type TorrentAiCacheKey = string
