// qBittorrent Web API Types

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
}

export type TorrentState =
  | 'error' // Some error occurred, applies to paused torrents
  | 'missingFiles' // Torrent data files is missing
  | 'uploading' // Torrent is being seeded and data is being transferred
  | 'pausedUP' // Torrent is paused and has finished downloading
  | 'queuedUP' // Queuing is enabled and torrent is queued for upload
  | 'stalledUP' // Torrent is being seeded, but no connection were made
  | 'checkingUP' // Torrent has finished downloading and is being checked
  | 'forcedUP' // Torrent is forced to uploading and ignore queue limit
  | 'allocating' // Torrent is allocating disk space for download
  | 'downloading' // Torrent is being downloaded and data is being transferred
  | 'metaDL' // Torrent has just started downloading and is fetching metadata
  | 'pausedDL' // Torrent is paused and has NOT finished downloading
  | 'queuedDL' // Queuing is enabled and torrent is queued for download
  | 'stalledDL' // Torrent is being downloaded, but no connection were made
  | 'checkingDL' // Same as checkingUP, but torrent has NOT finished downloading
  | 'forcedDL' // Torrent is forced to downloading to ignore queue limit
  | 'checkingResumeData' // Checking resume data on qBt startup

export interface Torrent {
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
  save_path: string
  completion_on: number
  tracker: string
  dl_limit: number
  up_limit: number
  downloaded: number
  uploaded: number
  downloaded_session: number
  uploaded_session: number
  amount_left: number
  time_active: number
  seeding_time: number
  nb_connections: number
}

export interface TorrentFile {
  id: number
  name: string
  size: number
  progress: number
  priority: number
  is_seed: boolean
  piece_range: [number, number]
  availability: number
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

export interface TorrentPeer {
  ip: string
  port: number
  country: string
  connection: string
  flags: string
  client: string
  progress: number
  dl_speed: number
  up_speed: number
  downloaded: number
  uploaded: number
  relevance: number
  files: string
}
export interface ServerInfo {
  version: string
  api_version: string
  api_version_min: string
  build_info: string
  os: string
  python_version: string
}

// Lightweight global transfer info
export interface TransferInfo {
  dl_info_speed: number
  up_info_speed: number
  dl_rate_limit: number
  up_rate_limit: number
  use_alt_speed_limits?: boolean
  // Session totals
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
}

export interface QBittorrentPreferences {
  // Download preferences
  save_path: string
  temp_path_enabled: boolean
  temp_path: string
  scan_dirs: Record<string, number>
  export_dir: string
  export_dir_fin: string
  mail_notification_enabled: boolean
  mail_notification_sender: string
  mail_notification_email: string
  mail_notification_smtp: string
  mail_notification_ssl_enabled: boolean
  mail_notification_auth_enabled: boolean
  mail_notification_username: string
  mail_notification_password: string
  autorun_enabled: boolean
  autorun_program: string
  autorun_on_torrent_added_enabled: boolean
  autorun_on_torrent_added_program: string

  // Torrent adding preferences
  torrent_content_layout: string
  add_trackers_enabled: boolean
  dont_start_download_automatically: boolean
  torrent_stop_condition: string
  create_subfolder_enabled: boolean
  preallocate_all: boolean
  incomplete_files_ext: boolean

  // Torrent management preferences
  torrent_management_mode: string
  torrent_category_changed_action: string
  torrent_default_save_path_changed_action: string
  torrent_category_save_path_changed_action: string

  // File exclusion
  excluded_file_names_enabled: boolean
  excluded_file_names: string

  // Connection preferences
  listen_port: number
  upnp: boolean
  random_port: boolean
  dl_limit: number
  up_limit: number
  max_connec: number
  max_connec_per_torrent: number
  max_uploads: number
  max_uploads_per_torrent: number

  // Proxy preferences
  proxy_type: number
  proxy_ip: string
  proxy_port: number
  proxy_peer_connections: boolean
  proxy_auth_enabled: boolean
  proxy_username: string
  proxy_password: string

  // Web UI preferences
  web_ui_domain_list: string
  web_ui_address: string
  web_ui_port: number
  web_ui_upnp: boolean
  web_ui_username: string
  web_ui_password: string
  web_ui_csrf_protection_enabled: boolean
  web_ui_clickjacking_protection_enabled: boolean
  web_ui_secure_cookie_enabled: boolean
  web_ui_max_auth_fail_count: number
  web_ui_ban_duration: number
  web_ui_session_timeout: number
  web_ui_host_header_validation_enabled: boolean
  web_ui_use_custom_http_headers_enabled: boolean
  web_ui_custom_http_headers: string
  web_ui_reverse_proxy_enabled: boolean
  web_ui_reverse_proxies_list: string
  web_ui_https_enabled: boolean
  web_ui_https_cert_path: string
  web_ui_https_key_path: string

  // Advanced preferences
  dht: boolean
  pex: boolean
  lsd: boolean
  encryption: number
  anonymous_mode: boolean
  queueing_enabled: boolean
  max_active_downloads: number
  max_active_torrents: number
  max_active_uploads: number
  dont_count_slow_torrents: boolean
  slow_torrent_dl_rate_threshold: number
  slow_torrent_ul_rate_threshold: number
  slow_torrent_inactive_timer: number
  max_ratio_enabled: boolean
  max_ratio: number
  max_ratio_act: number
  max_seeding_time_enabled: boolean
  max_seeding_time: number
  max_seeding_time_act: number
}
