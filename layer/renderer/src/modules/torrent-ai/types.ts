import type {
  TorrentAIEnrichmentResult,
  TorrentAIMetadata,
} from '@torrent-vibe/shared'

export type TorrentAiStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface TorrentAiEntry {
  hash: string
  rawName: string
  language: string
  status: TorrentAiStatus
  metadata: TorrentAIMetadata | null
  error: string | null
  requestedAt: number | null
  updatedAt: number | null
  retries: number
}

export interface TorrentAiState {
  initialized: boolean
  entries: Record<string, TorrentAiEntry>
}

export interface EnsureMetadataOptions {
  hash: string
  rawName: string
  force?: boolean
}

export type TorrentAiActionResult<T = void> = {
  ok: boolean
  data?: T
  error?: string
  transient?: boolean
}

export type TorrentAiEnrichmentResult = TorrentAIEnrichmentResult
export type TorrentAiMetadata = TorrentAIMetadata
