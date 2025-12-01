import { useEffect } from 'react'

import { QBittorrentClient } from '~/shared/api/qbittorrent-client'

import { multiServerStoreSetters } from '../modules/multi-server/stores/multi-server-store'
import { serverHealthMonitor } from '../modules/multi-server/stores/server-health-monitor'
import {
  loadMultiServerConfig,
  loadServerPassword,
  migrateToMultiServer,
  saveMultiServerConfig,
} from '../modules/multi-server/utils/server-config'

export const MultiServerInitializer = () => {
  useEffect(() => {
    if (!ELECTRON) return
    const existing = loadMultiServerConfig()
    const cfg = existing.servers.length > 0 ? existing : migrateToMultiServer()
    multiServerStoreSetters.replaceAll(cfg)
    // persist if migrated
    if (existing.servers.length === 0 && cfg.servers.length > 0) {
      saveMultiServerConfig(cfg)
    }

    // Pre-configure client to active server before auth init
    ;(async () => {
      const active = cfg.activeServerId
        ? cfg.servers.find((s) => s.id === cfg.activeServerId)
        : undefined
      if (active) {
        const password =
          (await loadServerPassword(active.id)) ?? active.config.password
        QBittorrentClient.configure({
          ...active.config,
          password: password ?? '',
        })
      }
    })()

    // Start health monitor
    serverHealthMonitor.start()
  }, [])

  return null
}
