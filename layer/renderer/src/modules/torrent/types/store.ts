import type { ServerState, TorrentInfo } from '~/types/torrent'

export interface TorrentStats {
  total: number
  downloading: number
  seeding: number
  completed: number
  paused: number
  error: number
}

export interface NetworkStats {
  globalDownloadSpeed: number
  globalUploadSpeed: number
  downloadLimit: number
  uploadLimit: number
  connectionStatus: string
}

export type TorrentFilterState =
  | 'all'
  | 'downloading'
  | 'seeding'
  | 'completed'
  | 'paused'
  | 'error'
  | { type: 'category'; value: string }
  | { type: 'tag'; value: string }
  | {
      type: 'multi'
      statuses?: string[]
      categories?: string[]
      tags?: string[]
    }

export type TorrentAction = 'pause' | 'resume' | 'delete'

// Sticky filter entry - keeps track of torrents that should remain visible
// in their original filter even after state change
export interface StickyFilterEntry {
  hash: string
  originalFilter: TorrentFilterState
  operationTime: number
}

// Duration to keep torrents "sticky" in their original filter (in milliseconds)
export const STICKY_FILTER_DURATION = 1 * 60 * 1000 // 1 minute

export interface TorrentStoreState {
  // === SERVER STATE ===
  torrents: TorrentInfo[]
  serverState: ServerState | null
  categories: Record<string, { name: string; savePath: string }> | null
  tags: string[] | null
  lastUpdated: number

  // === CLIENT STATE ===
  selectedTorrents: string[]
  sortKey: keyof TorrentInfo
  sortDirection: 'asc' | 'desc'
  filterState: TorrentFilterState
  searchQuery?: string

  // === STICKY FILTER STATE ===
  // Keeps track of torrents that should temporarily remain visible in their original filter
  stickyFilterEntries: StickyFilterEntry[]

  // === COMPUTED STATE ===
  sortedTorrents: TorrentInfo[]
  // Hash-based lookup for O(1) access by torrent hash
  torrentsByHash: Record<string, TorrentInfo>
}

// Store only contains state - computed values moved to hooks
export type TorrentStore = TorrentStoreState
