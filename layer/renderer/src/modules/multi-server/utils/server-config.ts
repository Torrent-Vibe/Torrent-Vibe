import { ipcServices } from '~/lib/ipc-client'
import { storage, STORAGE_KEYS } from '~/lib/storage-keys'
import {
  getInitialQBittorrentConfig,
  loadStoredConnectionConfig,
} from '~/shared/config'
import type { QBittorrentConfig } from '~/shared/types/qbittorrent'

import type { MultiServerConfig, ServerConnection } from '../types/multi-server'
import { multiServerConfigSchema } from '../types/multi-server'

const emptyConfig: MultiServerConfig = { servers: [], activeServerId: null }

export function loadMultiServerConfig(): MultiServerConfig {
  const data = storage.getJSON<MultiServerConfig>(
    STORAGE_KEYS.MULTI_SERVER_CONFIG,
  )
  if (!data) return emptyConfig
  const parsed = multiServerConfigSchema.safeParse(data)
  if (!parsed.success) return emptyConfig
  return parsed.data
}

export function saveMultiServerConfig(cfg: MultiServerConfig): void {
  // Do not persist passwords inside the config object
  const sanitized: MultiServerConfig = {
    servers: cfg.servers.map((s) => ({
      ...s,
      config: { ...s.config, password: '' },
    })),
    activeServerId: cfg.activeServerId,
  }
  storage.setJSON(STORAGE_KEYS.MULTI_SERVER_CONFIG, sanitized)
}

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

export function createServerFromConfig(
  name: string,
  cfg: QBittorrentConfig,
  isDefault = false,
): ServerConnection {
  return {
    id: genId(),
    name,
    config: cfg,
    isDefault,
    status: 'disconnected',
  }
}

/**
 * Migrate legacy single-server storage to multi-server format.
 * If nothing to migrate, returns an empty config.
 */
export function migrateToMultiServer(): MultiServerConfig {
  const ms = loadMultiServerConfig()
  if (ms.servers.length > 0) return ms

  // Load legacy (single-server) stored config
  const { stored, password } = loadStoredConnectionConfig()
  if (!stored) return emptyConfig

  const initial = getInitialQBittorrentConfig()
  const cfg: QBittorrentConfig = {
    host: stored.host ?? initial.host,
    port: stored.port ?? initial.port,
    username: stored.username ?? initial.username,
    password: password ?? initial.password,
    useHttps: stored.useHttps ?? initial.useHttps,
    baseUrl: stored.baseUrl,
  }
  const server = createServerFromConfig('Primary Server', cfg, true)
  return { servers: [server], activeServerId: server.id }
}

export async function saveServerPassword(serverId: string, password: string) {
  const key = STORAGE_KEYS.serverPasswordKey(serverId)
  if (typeof ELECTRON !== 'undefined' && ELECTRON) {
    try {
      const available = await ipcServices?.security.isEncryptionAvailable()
      if (available) {
        const enc = await ipcServices?.security.encryptString(password)
        storage.setItem(key, `enc:${enc}`)
        return
      }
    } catch {
      // fallthrough
    }
  }
  storage.setItem(key, password)
}

export function hasServerPassword(serverId: string): boolean {
  return storage.getItem(STORAGE_KEYS.serverPasswordKey(serverId)) != null
}

export async function loadServerPassword(
  serverId: string,
): Promise<string | undefined> {
  const key = STORAGE_KEYS.serverPasswordKey(serverId)
  const val = storage.getItem(key)
  if (!val) return undefined
  if (val.startsWith('enc:')) {
    const payload = val.slice(4)
    if (typeof ELECTRON !== 'undefined' && ELECTRON) {
      try {
        const dec = await ipcServices?.security.decryptString(payload)
        return dec
      } catch {
        return undefined
      }
    }
    return undefined
  }
  return val
}
