import { formatSpeed } from '~/lib/format'
import type { TorrentInfo } from '~/types/torrent'

export type TorrentHashIndex = Record<string, TorrentInfo>

export const buildTorrentHashIndex = (
  torrentsByHash: Record<string, TorrentInfo>,
): TorrentHashIndex => {
  const index: TorrentHashIndex = {}
  for (const torrent of Object.values(torrentsByHash)) {
    index[torrent.hash.toLowerCase()] = torrent
  }
  return index
}

export const findTorrentByInfohash = (
  infohash: string | undefined,
  index: TorrentHashIndex,
): TorrentInfo | undefined =>
  infohash ? index[infohash.toLowerCase()] : undefined

export interface EpisodeLiveProgress {
  displayText: string
}

export const episodeLiveProgressFor = (
  torrent: TorrentInfo | undefined,
): EpisodeLiveProgress | null => {
  if (!torrent) {
    return null
  }
  const percentText = `${Math.round(torrent.progress * 100)}%`
  const displayText =
    torrent.dlspeed > 0
      ? `${percentText} · ${formatSpeed(torrent.dlspeed)}`
      : percentText
  return { displayText }
}
