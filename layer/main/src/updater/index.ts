import { isDevelopment } from '~/constants'
import { AppAutoUpdater } from '~/services/app-auto-updater'
import { BridgeService } from '~/services/bridge-service'

import type { UpdaterUiStatus } from './status'
import type { UpdaterHandle } from './updater'
import { initSparkleUpdater } from './updater'

const noopHandle: UpdaterHandle = {
  checkNow: () => {},
  silentCheckOnActivate: () => {},
  getStatus: () => ({ kind: 'unknown' }),
  onStatus: () => () => {},
  installNow: () => {},
}

let handle: UpdaterHandle | null = null

export function getUpdaterHandle(): UpdaterHandle {
  return handle ?? noopHandle
}

export function initUpdater(): UpdaterHandle {
  if (handle) {
    return handle
  }

  if (process.platform === 'darwin') {
    handle = initSparkleUpdater({ isDev: isDevelopment })
  }
  else {
    AppAutoUpdater.instance.initialize()
    AppAutoUpdater.instance.checkForUpdates()
    handle = AppAutoUpdater.instance
  }

  handle.onStatus((status: UpdaterUiStatus) => {
    BridgeService.shared.broadcast('updater:status', status)
  })

  return handle
}

export type { UpdaterUiStatus } from './status'
export type { UpdaterHandle } from './updater'
