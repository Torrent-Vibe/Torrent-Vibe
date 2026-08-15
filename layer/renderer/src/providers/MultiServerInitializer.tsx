import { useEffect } from 'react'

import {
  multiServerStoreSetters,
  useMultiServerStore,
} from '../modules/multi-server/stores/multi-server-store'
import { serverHealthMonitor } from '../modules/multi-server/stores/server-health-monitor'
import {
  loadMultiServerConfig,
  migrateToMultiServer,
  saveMultiServerConfig,
} from '../modules/multi-server/utils/server-config'

export const MultiServerInitializer = () => {
  useEffect(() => {
    if (!ELECTRON) { return }
    const existing = loadMultiServerConfig()
    const cfg = existing.servers.length > 0 ? existing : migrateToMultiServer()
    multiServerStoreSetters.replaceAll(cfg)
    if (existing.servers.length === 0 && cfg.servers.length > 0) {
      saveMultiServerConfig(cfg)
    }

    const startHealthIfNeeded = (count: number) => {
      if (count > 1) {
        serverHealthMonitor.start()
      }
      else {
        serverHealthMonitor.stop()
      }
    }
    startHealthIfNeeded(cfg.servers.length)
    return useMultiServerStore.subscribe(
      s => s.order.length,
      startHealthIfNeeded,
    )
  }, [])

  return null
}
