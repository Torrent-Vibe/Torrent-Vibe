import { useQBQuery } from '~/lib/query/query-hooks'

/**
 * Hook to fetch torrent files
 */
export const useTorrentFiles = (hash: string | null) => {
  return useQBQuery.torrentFiles(hash)
}

/**
 * Hook to fetch torrent peers
 */
export const useTorrentPeers = (hash: string | null, rid?: number) => {
  return useQBQuery.torrentPeers(hash, rid)
}

/**
 * Hook to fetch torrent trackers
 */
export const useTorrentTrackers = (hash: string | null) => {
  return useQBQuery.torrentTrackers(hash)
}

/**
 * Hook to fetch torrent properties
 */
export const useTorrentProperties = (hash: string | null) => {
  return useQBQuery.torrentProperties(hash)
}

/**
 * Hook to fetch piece states
 */
export const useTorrentPieceStates = (hash: string | null) => {
  return useQBQuery.torrentPieceStates(hash)
}

/**
 * Hook to get all torrent details at once
 */
export const useTorrentDetails = (hash: string | null) => {
  const files = useTorrentFiles(hash)
  const peers = useTorrentPeers(hash)
  const trackers = useTorrentTrackers(hash)
  const properties = useTorrentProperties(hash)
  const pieceStates = useTorrentPieceStates(hash)

  return {
    files: files.data,
    peers: peers.data,
    trackers: trackers.data,
    properties: properties.data,
    pieceStates: pieceStates.data,
    isLoading:
      files.isLoading ||
      peers.isLoading ||
      trackers.isLoading ||
      properties.isLoading ||
      pieceStates.isLoading,
    error: files.error || peers.error || trackers.error || properties.error,
    isFilesLoading: files.isLoading,
    isPeersLoading: peers.isLoading,
    isTrackersLoading: trackers.isLoading,
    isPropertiesLoading: properties.isLoading,
    isPieceStatesLoading: pieceStates.isLoading,
  }
}
