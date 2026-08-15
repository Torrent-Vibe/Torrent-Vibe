import type {
  HelperEpisodeState,
  HelperReplica,
} from '@torrent-vibe/helper-protocol'
import type { RssEpisode } from '@torrent-vibe/mikan'

export const DEFAULT_HELPER_PORT = 17890
export const WEB_SERVER_ID = 'web'

export interface HelperDiscoverInfo {
  version: string
  bindState: 'bound' | 'unbound' | string
  advertisedQbitUrl: string
  pairingCode: string
  port: number
}

export interface HelperBinding {
  url: string
  token: string
}

export interface HelperEpisodeStatus {
  episodeId: string
  infohash?: string
  title: string
  season: number | null
  episode: number | null
  state: HelperEpisodeState
  lastError?: string
}

export interface HelperReplicaStatus extends HelperReplica {
  episodes: HelperEpisodeStatus[]
}

export interface HelperJobStatus {
  bangumiId: string
  subgroupId: string
  episodes: HelperEpisodeStatus[]
}

export interface HelperStatusResponse {
  replicas: HelperReplicaStatus[]
  jobs: HelperJobStatus[]
}

export interface HelperBackfillInput {
  bangumiId: string
  subgroupId: string
  episodes: RssEpisode[]
}

export interface ServerHelperTarget {
  id: string
  name: string
  host: string
  paired: boolean
}
