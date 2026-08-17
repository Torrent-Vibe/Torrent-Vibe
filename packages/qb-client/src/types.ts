// Types shared by the qBittorrent client package

export interface QBittorrentConfig {
  /**
   * Optional explicit base URL.
   * When provided it should include protocol and host (e.g. https://qb.example.com)
   * or can be a relative path (e.g. '/api') when the backend is reverse-proxied
   * behind the same origin. If set, host/port/useHttps can be ignored by the client.
   */
  baseUrl?: string
  fetch?: typeof fetch
  host: string
  password: string
  port: number
  useHttps: boolean

  username: string
}

export interface AddTorrentOptions {
  autoTMM?: boolean
  category?: string
  cookie?: string
  dlLimit?: number
  firstLastPiecePrio?: boolean
  ratioLimit?: number
  rename?: string
  root_folder?: boolean
  savepath?: string
  seedingTimeLimit?: number
  sequentialDownload?: boolean
  skip_checking?: boolean
  stopped?: boolean
  tags?: string
  torrents?: File[] | Blob[]
  upLimit?: number
  urls?: string
}

export interface TransferInfo {
  dl_info_data?: number
  dl_info_speed: number
  dl_rate_limit: number
  up_info_data?: number
  up_info_speed: number
  up_rate_limit: number
  use_alt_speed_limits?: boolean
}

export interface TorrentFilters {
  category?: string
  filter?:
    | 'all'
    | 'downloading'
    | 'seeding'
    | 'completed'
    | 'paused'
    | 'active'
    | 'inactive'
    | 'resumed'
    | 'stalled'
    | 'stalled_uploading'
    | 'stalled_downloading'
    | 'errored'
  hashes?: string | string[]
  limit?: number
  offset?: number
  reverse?: boolean
  sort?: string
  tag?: string
}

// Types mirroring qBittorrent Web API structures used by client

export type TorrentState =
  | 'error'
  | 'pausedUP'
  | 'pausedDL'
  | 'queuedUP'
  | 'queuedDL'
  | 'uploading'
  | 'stalledUP'
  | 'checkingUP'
  | 'checkingDL'
  | 'downloading'
  | 'stoppedDL'
  | 'stoppedUP'
  | 'stalledDL'
  | 'forcedDL'
  | 'ForcedMetaDL'
  | 'forcedUP'
  | 'metaDL'
  | 'allocating'
  | 'queuedForChecking'
  | 'checkingResumeData'
  | 'missingFiles'
  | 'moving'
  | 'unknown'

export interface TorrentInfo {
  added_on: number
  amount_left: number
  auto_tmm: boolean
  availability: number
  category: string
  completed: number
  completion_on: number
  content_path: string
  dl_limit: number
  dlspeed: number
  downloaded: number
  downloaded_session: number
  eta: number
  f_l_piece_prio: boolean
  force_start: boolean
  hash: string
  isPrivate?: boolean
  last_activity: number
  magnet_uri: string
  max_ratio: number
  max_seeding_time: number
  name: string
  num_complete: number
  num_incomplete: number
  num_leechs: number
  num_seeds: number
  priority: number
  progress: number
  ratio: number
  ratio_limit: number
  save_path: string
  seeding_time: number
  seeding_time_limit: number
  seen_complete: number
  seq_dl: boolean
  size: number
  state: TorrentState
  super_seeding: boolean
  tags: string
  time_active: number
  total_size: number
  tracker: string
  up_limit: number
  uploaded: number
  uploaded_session: number
  upspeed: number
}

export interface ServerState {
  alltime_dl: number
  alltime_ul: number
  average_time_queue: number
  connection_status: 'connected' | 'firewalled' | 'disconnected'
  dht_nodes: number
  dl_info_data: number
  dl_info_speed: number
  dl_rate_limit: number
  free_space_on_disk: number
  global_ratio: string
  queued_io_jobs: number
  queueing: boolean
  read_cache_hits: string
  read_cache_overload: string
  refresh_interval: number
  total_buffers_size: number
  total_peer_connections: number
  total_queued_size: number
  total_wasted_session: number
  up_info_data: number
  up_info_speed: number
  up_rate_limit: number
  use_alt_speed_limits: boolean
  use_subcategories: boolean
  write_cache_overload: string
}

export interface MainData {
  categories: Record<string, unknown>
  categories_removed: string[]
  full_update: boolean
  rid: number
  server_state: ServerState
  tags: string[]
  tags_removed: string[]
  torrents: Record<string, Partial<TorrentInfo>>
  torrents_removed: string[]
}

export interface TorrentFile {
  availability: number
  index: number
  is_seed?: boolean
  name: string
  piece_range: [number, number]
  priority: number
  progress: number
  size: number
}

export interface TorrentPeer {
  client: string
  connection: string
  country: string
  country_code: string
  dl_speed: number
  downloaded: number
  files: string
  flags: string
  flags_desc: string
  ip: string
  port: number
  progress: number
  relevance: number
  up_speed: number
  uploaded: number
}

export interface TorrentTracker {
  msg: string
  num_downloaded: number
  num_leeches: number
  num_peers: number
  num_seeds: number
  status: number
  tier: number
  url: string
}

export interface TorrentProperties {
  addition_date: number
  comment: string
  completion_date: number
  created_by: string
  creation_date: number
  dl_limit: number
  dl_speed: number
  dl_speed_avg: number
  eta: number
  hash: string
  infohash_v1: string
  infohash_v2: string
  is_private?: boolean
  last_seen: number
  name: string
  nb_connections: number
  nb_connections_limit: number
  peers: number
  peers_total: number
  piece_size: number
  pieces_have: number
  pieces_num: number
  reannounce: number
  save_path: string
  seeding_time: number
  seeds: number
  seeds_total: number
  share_ratio: number
  time_elapsed: number
  total_downloaded: number
  total_downloaded_session: number
  total_size: number
  total_uploaded: number
  total_uploaded_session: number
  total_wasted: number
  up_limit: number
  up_speed: number
  up_speed_avg: number
}
