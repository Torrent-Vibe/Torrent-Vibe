// Types shared by the qBittorrent client package

export interface QBittorrentConfig {
  host: string
  port: number
  username: string
  password: string
  useHttps: boolean
  /**
   * Optional explicit base URL.
   * When provided it should include protocol and host (e.g. https://qb.example.com)
   * or can be a relative path (e.g. '/api') when the backend is reverse-proxied
   * behind the same origin. If set, host/port/useHttps can be ignored by the client.
   */
  baseUrl?: string

  fetch?: typeof fetch
}

export interface AddTorrentOptions {
  urls?: string
  torrents?: File[] | Blob[]
  savepath?: string
  cookie?: string
  category?: string
  tags?: string
  skip_checking?: boolean
  stopped?: boolean
  root_folder?: boolean
  rename?: string
  upLimit?: number
  dlLimit?: number
  ratioLimit?: number
  seedingTimeLimit?: number
  autoTMM?: boolean
  sequentialDownload?: boolean
  firstLastPiecePrio?: boolean
}

export interface TransferInfo {
  dl_info_speed: number
  up_info_speed: number
  dl_rate_limit: number
  up_rate_limit: number
  use_alt_speed_limits?: boolean
  dl_info_data?: number
  up_info_data?: number
}

export interface TorrentFilters {
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
  category?: string
  tag?: string
  sort?: string
  reverse?: boolean
  limit?: number
  offset?: number
  hashes?: string | string[]
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
  hash: string
  name: string
  size: number
  progress: number
  dlspeed: number
  upspeed: number
  priority: number
  num_seeds: number
  num_leechs: number
  ratio: number
  eta: number
  state: TorrentState
  category: string
  tags: string
  added_on: number
  completion_on: number
  last_activity: number
  dl_limit: number
  up_limit: number
  downloaded: number
  uploaded: number
  downloaded_session: number
  uploaded_session: number
  amount_left: number
  auto_tmm: boolean
  availability: number
  completed: number
  content_path: string
  f_l_piece_prio: boolean
  force_start: boolean
  magnet_uri: string
  max_ratio: number
  max_seeding_time: number
  num_complete: number
  num_incomplete: number
  ratio_limit: number
  save_path: string
  seeding_time: number
  seeding_time_limit: number
  seen_complete: number
  seq_dl: boolean
  super_seeding: boolean
  time_active: number
  total_size: number
  tracker: string
  isPrivate?: boolean
}

export interface ServerState {
  connection_status: 'connected' | 'firewalled' | 'disconnected'
  alltime_dl: number
  alltime_ul: number
  average_time_queue: number
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
  rid: number
  full_update: boolean
  torrents: Record<string, Partial<TorrentInfo>>
  torrents_removed: string[]
  categories: Record<string, unknown>
  categories_removed: string[]
  tags: string[]
  tags_removed: string[]
  server_state: ServerState
}

export interface TorrentFile {
  index: number
  name: string
  size: number
  progress: number
  priority: number
  is_seed?: boolean
  piece_range: [number, number]
  availability: number
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
  url: string
  status: number
  tier: number
  num_peers: number
  num_seeds: number
  num_leeches: number
  num_downloaded: number
  msg: string
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
