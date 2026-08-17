import type {
  TorrentAIEnrichmentResult,
  TorrentAIMetadata,
} from '@torrent-vibe/shared'

export type TorrentAiStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface TorrentAiEntry {
  error: string | null
  hash: string
  language: string
  metadata: TorrentAIMetadata | null
  rawName: string
  requestedAt: number | null
  retries: number
  status: TorrentAiStatus
  updatedAt: number | null
}

export interface TorrentAiState {
  entries: Record<string, TorrentAiEntry>
  initialized: boolean
}

export interface EnsureMetadataOptions {
  force?: boolean
  hash: string
  rawName: string
}

export type TorrentAiActionResult<T = void> = {
  ok: boolean
  data?: T
  error?: string
  transient?: boolean
}

export type TorrentAiEnrichmentResult = TorrentAIEnrichmentResult
export type TorrentAiMetadata = TorrentAIMetadata
