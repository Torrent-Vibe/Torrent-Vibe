import type { ServerState, TorrentInfo } from '~/types/torrent'

export interface TorrentStats {
  completed: number
  downloading: number
  error: number
  paused: number
  seeding: number
  total: number
}

export interface NetworkStats {
  connectionStatus: string
  downloadLimit: number
  globalDownloadSpeed: number
  globalUploadSpeed: number
  uploadLimit: number
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
  operationTime: number
  originalFilter: TorrentFilterState
}

// Duration to keep torrents "sticky" in their original filter (in milliseconds)
export const STICKY_FILTER_DURATION = 1 * 60 * 1000 // 1 minute

export interface TorrentStoreState {
  categories: Record<string, { name: string; savePath: string }> | null
  filterState: TorrentFilterState
  lastUpdated: number
  searchQuery?: string
  // === CLIENT STATE ===
  selectedTorrents: string[]

  serverState: ServerState | null
  sortDirection: 'asc' | 'desc'
  // === COMPUTED STATE ===
  sortedTorrents: TorrentInfo[]
  sortKey: keyof TorrentInfo
  // === STICKY FILTER STATE ===
  // Keeps track of torrents that should temporarily remain visible in their original filter
  stickyFilterEntries: StickyFilterEntry[]

  tags: string[] | null

  // === SERVER STATE ===
  torrents: TorrentInfo[]
  // Hash-based lookup for O(1) access by torrent hash
  torrentsByHash: Record<string, TorrentInfo>
}

// Store only contains state - computed values moved to hooks
export type TorrentStore = TorrentStoreState
