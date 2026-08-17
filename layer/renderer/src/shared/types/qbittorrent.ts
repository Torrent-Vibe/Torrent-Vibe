// qBittorrent Web API Types

export interface QBittorrentConfig {
  /**
   * Optional explicit base URL.
   * When provided it should include protocol and host (e.g. https://qb.example.com)
   * or can be a relative path (e.g. '/api') when the backend is reverse-proxied
   * behind the same origin. If set, host/port/useHttps can be ignored by the client.
   */
  baseUrl?: string
  host: string
  password: string
  port: number
  useHttps: boolean
  username: string
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
  amount_left: number
  category: string
  completion_on: number
  dl_limit: number
  dlspeed: number
  downloaded: number
  downloaded_session: number
  eta: number
  hash: string
  name: string
  nb_connections: number
  num_leechs: number
  num_seeds: number
  priority: number
  progress: number
  ratio: number
  save_path: string
  seeding_time: number
  size: number
  state: TorrentState
  tags: string
  time_active: number
  tracker: string
  up_limit: number
  uploaded: number
  uploaded_session: number
  upspeed: number
}

export interface TorrentFile {
  availability: number
  id: number
  is_seed: boolean
  name: string
  piece_range: [number, number]
  priority: number
  progress: number
  size: number
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

export interface TorrentPeer {
  client: string
  connection: string
  country: string
  dl_speed: number
  downloaded: number
  files: string
  flags: string
  ip: string
  port: number
  progress: number
  relevance: number
  up_speed: number
  uploaded: number
}
export interface ServerInfo {
  api_version: string
  api_version_min: string
  build_info: string
  os: string
  python_version: string
  version: string
}

// Lightweight global transfer info
export interface TransferInfo {
  // Session totals
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
  limit?: number
  offset?: number
  reverse?: boolean
  sort?: string
  tag?: string
}

export interface QBittorrentPreferences {
  add_trackers_enabled: boolean
  anonymous_mode: boolean
  autorun_enabled: boolean
  autorun_on_torrent_added_enabled: boolean
  autorun_on_torrent_added_program: string
  autorun_program: string
  create_subfolder_enabled: boolean
  // Advanced preferences
  dht: boolean
  dl_limit: number
  dont_count_slow_torrents: boolean
  dont_start_download_automatically: boolean
  encryption: number
  excluded_file_names: string
  // File exclusion
  excluded_file_names_enabled: boolean
  export_dir: string
  export_dir_fin: string
  incomplete_files_ext: boolean
  // Connection preferences
  listen_port: number

  lsd: boolean
  mail_notification_auth_enabled: boolean
  mail_notification_email: string
  mail_notification_enabled: boolean
  mail_notification_password: string
  mail_notification_sender: string
  mail_notification_smtp: string

  mail_notification_ssl_enabled: boolean
  mail_notification_username: string
  max_active_downloads: number
  max_active_torrents: number

  max_active_uploads: number
  max_connec: number

  max_connec_per_torrent: number
  max_ratio: number
  max_ratio_act: number
  max_ratio_enabled: boolean
  max_seeding_time: number
  max_seeding_time_act: number
  max_seeding_time_enabled: boolean
  max_uploads: number
  max_uploads_per_torrent: number

  pex: boolean
  preallocate_all: boolean
  proxy_auth_enabled: boolean
  proxy_ip: string
  proxy_password: string
  proxy_peer_connections: boolean
  proxy_port: number

  // Proxy preferences
  proxy_type: number
  proxy_username: string
  queueing_enabled: boolean
  random_port: boolean
  // Download preferences
  save_path: string
  scan_dirs: Record<string, number>
  slow_torrent_dl_rate_threshold: number
  slow_torrent_inactive_timer: number
  slow_torrent_ul_rate_threshold: number
  temp_path: string
  temp_path_enabled: boolean
  torrent_category_changed_action: string
  torrent_category_save_path_changed_action: string
  // Torrent adding preferences
  torrent_content_layout: string
  torrent_default_save_path_changed_action: string
  // Torrent management preferences
  torrent_management_mode: string
  torrent_stop_condition: string
  up_limit: number
  upnp: boolean
  web_ui_address: string

  web_ui_ban_duration: number
  web_ui_clickjacking_protection_enabled: boolean
  web_ui_csrf_protection_enabled: boolean
  web_ui_custom_http_headers: string
  // Web UI preferences
  web_ui_domain_list: string
  web_ui_host_header_validation_enabled: boolean
  web_ui_https_cert_path: string
  web_ui_https_enabled: boolean
  web_ui_https_key_path: string
  web_ui_max_auth_fail_count: number
  web_ui_password: string
  web_ui_port: number
  web_ui_reverse_proxies_list: string
  web_ui_reverse_proxy_enabled: boolean
  web_ui_secure_cookie_enabled: boolean
  web_ui_session_timeout: number
  web_ui_upnp: boolean
  web_ui_use_custom_http_headers_enabled: boolean
  web_ui_username: string
}
