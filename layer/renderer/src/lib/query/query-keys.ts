/**
 * Type-safe query key factory for qBittorrent client
 * Provides centralized management of all React Query keys
 */

export const QueryKeys = {
  discover: {
    imdb: (id: string) => ['discover', 'imdb', id] as const,
  },
  // Torrent-related queries
  torrents: {
    all: () => ['torrents'] as const,
    serverState: (type: 'prefetch' | 'main') =>
      ['torrents', 'serverState', type] as const,
    list: (filter?: string) => ['torrents', 'list', filter] as const,
  },

  // Category management
  categories: {
    all: () => ['categories'] as const,
    withCounts: () => ['categories', 'withCounts'] as const,
  },

  // Tag management
  tags: {
    all: () => ['tags'] as const,
    withCounts: () => ['tags', 'withCounts'] as const,
  },

  // Individual torrent details
  torrentDetails: {
    all: (hash: string) => ['torrent-details', hash] as const,
    files: (hash: string) => ['torrent-files', hash] as const,
    peers: (hash: string, rid?: number) =>
      ['torrent-peers', hash, rid] as const,
    trackers: (hash: string) => ['torrent-trackers', hash] as const,
    properties: (hash: string) => ['torrent-properties', hash] as const,
    pieceStates: (hash: string) => ['torrent-piece-states', hash] as const,
  },

  // qBittorrent application settings
  qbittorrent: {
    preferences: () => ['qbittorrent', 'preferences'] as const,
    version: () => ['qbittorrent', 'version'] as const,
    buildInfo: () => ['qbittorrent', 'buildInfo'] as const,
    mainData: (rid?: number) => ['qbittorrent', 'maindata', rid] as const,
  },
} as const

// Type helpers for query keys
export type QueryKeyCategory = keyof typeof QueryKeys

// Extract all possible query key types for type safety
export type QueryKey =
  | ReturnType<typeof QueryKeys.discover.imdb>
  | ReturnType<typeof QueryKeys.torrents.all>
  | ReturnType<typeof QueryKeys.torrents.serverState>
  | ReturnType<typeof QueryKeys.torrents.list>
  | ReturnType<typeof QueryKeys.categories.all>
  | ReturnType<typeof QueryKeys.categories.withCounts>
  | ReturnType<typeof QueryKeys.tags.all>
  | ReturnType<typeof QueryKeys.tags.withCounts>
  | ReturnType<typeof QueryKeys.torrentDetails.all>
  | ReturnType<typeof QueryKeys.torrentDetails.files>
  | ReturnType<typeof QueryKeys.torrentDetails.peers>
  | ReturnType<typeof QueryKeys.torrentDetails.trackers>
  | ReturnType<typeof QueryKeys.torrentDetails.properties>
  | ReturnType<typeof QueryKeys.torrentDetails.pieceStates>
  | ReturnType<typeof QueryKeys.qbittorrent.preferences>
  | ReturnType<typeof QueryKeys.qbittorrent.version>
  | ReturnType<typeof QueryKeys.qbittorrent.buildInfo>
  | ReturnType<typeof QueryKeys.qbittorrent.mainData>

// Utility type to extract query key type from factory function
export type QueryKeyType<T extends readonly unknown[]> = T

// Type for query key factory functions
export type QueryKeyFactory<T extends readonly unknown[]> = (
  ...args: any[]
) => T
