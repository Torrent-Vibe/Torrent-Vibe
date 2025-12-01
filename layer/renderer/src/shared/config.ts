import { defaultConnectionConfig } from '~/app.config'
import { storage, STORAGE_KEYS } from '~/lib/storage-keys'
import type { MultiServerConfig } from '~/modules/multi-server/types/multi-server'

import type { QBittorrentConfig } from './types/qbittorrent'

export interface StoredConnectionConfig {
  host: string
  port: number
  username: string
  useHttps: boolean
  rememberPassword: boolean
  /**
   * Optional persisted baseUrl override (can be absolute or relative like '/api')
   */
  baseUrl?: string
}

export function loadStoredConnectionConfig(): {
  stored?: StoredConnectionConfig
  password?: string
} {
  try {
    const stored = storage.getJSON<StoredConnectionConfig>(
      STORAGE_KEYS.CONNECTION_CONFIG,
    )
    const password =
      storage.getItem(STORAGE_KEYS.CONNECTION_PASSWORD) ?? undefined
    return { stored: stored ?? undefined, password }
  } catch {
    return {}
  }
}

export function saveStoredConnectionConfig(
  config: QBittorrentConfig,
  rememberPassword: boolean,
) {
  const toStore: StoredConnectionConfig = {
    host: config.host,
    port: config.port,
    username: config.username,
    useHttps: config.useHttps,
    rememberPassword,
    baseUrl: config.baseUrl,
  }
  storage.setJSON(STORAGE_KEYS.CONNECTION_CONFIG, toStore)
  if (rememberPassword && config.password) {
    storage.setItem(STORAGE_KEYS.CONNECTION_PASSWORD, config.password)
  } else {
    storage.removeItem(STORAGE_KEYS.CONNECTION_PASSWORD)
  }
}

export function getInitialQBittorrentConfig(): QBittorrentConfig {
  const { stored, password } = loadStoredConnectionConfig()
  if (!stored) {
    const cfg = { ...defaultConnectionConfig }
    // If the app is served via HTTPS, prefer HTTPS for backend too to avoid mixed content
    if (
      typeof globalThis !== 'undefined' &&
      globalThis.location !== undefined &&
      globalThis.location.protocol === 'https:'
    ) {
      cfg.useHttps = true
    }
    return cfg
  }
  const result: QBittorrentConfig = {
    host: stored.host ?? defaultConnectionConfig.host,
    port: stored.port ?? defaultConnectionConfig.port,
    username: stored.username ?? defaultConnectionConfig.username,
    useHttps: stored.useHttps ?? defaultConnectionConfig.useHttps,
    password: password ?? defaultConnectionConfig.password,
    baseUrl: stored.baseUrl,
  }
  // Coerce to HTTPS when the app is served over HTTPS to prevent mixed-content
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.location !== undefined &&
    globalThis.location.protocol === 'https:'
  ) {
    result.useHttps = true
  }
  return result
}

export function checkHasPersistConnectionConfig(): boolean {
  const { stored } = loadStoredConnectionConfig()
  return Boolean(
    stored &&
      stored.username &&
      stored.useHttps !== undefined &&
      // Either a baseUrl is stored, or host/port are present
      (stored.baseUrl || (stored.host && stored.port)),
  )
}

export function checkHasPersistMultiServerConfig(): boolean {
  const multiServerConfig = storage.getJSON<MultiServerConfig>(
    STORAGE_KEYS.MULTI_SERVER_CONFIG,
  )

  return Boolean(multiServerConfig && multiServerConfig.servers.length > 0)
}
