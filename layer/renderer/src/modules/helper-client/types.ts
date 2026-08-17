import type {
  HelperEpisodeState,
  HelperReplica,
} from '@torrent-vibe/helper-protocol'
import type { RssEpisode } from '@torrent-vibe/mikan'

export const DEFAULT_HELPER_PORT = 17890
export const WEB_SERVER_ID = 'web'

export interface HelperDiscoverInfo {
  advertisedQbitUrl: string
  bindState: 'bound' | 'unbound' | string
  clientCount: number
  port: number
  requiresPairingCode: boolean
  version: string
}

export interface HelperBinding {
  clientId?: string
  token: string
  url: string
}

export interface HelperEpisodeStatus {
  episode: number | null
  episodeId: string
  infohash?: string
  lastError?: string
  season: number | null
  state: HelperEpisodeState
  title: string
}

export interface HelperReplicaStatus extends HelperReplica {
  episodes: HelperEpisodeStatus[]
}

export interface HelperJobStatus {
  bangumiId: string
  episodes: HelperEpisodeStatus[]
  subgroupId: string
}

export interface HelperStatusResponse {
  jobs: HelperJobStatus[]
  replicas: HelperReplicaStatus[]
}

export interface HelperBackfillInput {
  bangumiId: string
  episodes: RssEpisode[]
  subgroupId: string
}

export interface ServerHelperTarget {
  host: string
  id: string
  name: string
  paired: boolean
}

export interface HelperConfigPublic {
  category: string
  hasQbitPass: boolean
  hasTmdbApiKey: boolean
  libraryRoot: string
  pollIntervalMs: number
  proxyUrl: string
  qbitUrl: string
  qbitUser: string
  variantPrefer: string
}

export type HelperConfigPatch = Partial<{
  libraryRoot: string
  category: string
  qbitUrl: string
  qbitUser: string
  qbitPass: string
  pollIntervalMs: number
  proxyUrl: string
  variantPrefer: string
  tmdbApiKey: string
}>
