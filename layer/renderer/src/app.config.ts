import type { QBittorrentConfig } from './shared/types/qbittorrent'

export const defaultConnectionConfig: QBittorrentConfig = {
  host: '',
  port: 8080,
  username: 'admin',
  password: '',
  // Prefer HTTPS when the app is served over HTTPS to avoid mixed-content blocks
  useHttps:
    typeof globalThis !== 'undefined' && globalThis.location !== undefined
      ? globalThis.location.protocol === 'https:'
      : false,
}
