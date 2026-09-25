import { join } from 'node:path'

import { app } from 'electron'
import type { SparkleBridge } from 'electron-sparkle-updater'
import { loadSparkleBridge } from 'electron-sparkle-updater'

export type {
  SparkleBridge,
  SparkleBridgeEvent,
  SparkleInitOptions,
} from 'electron-sparkle-updater'

const ADDON_FILE = 'sparkle_bridge.node'

// tsdown bundles the library into dist/main, so it cannot find its own package root;
// packaged builds ship the addon through electron-builder's mac extraResources instead.
function resolveAddonPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'sparkle', ADDON_FILE)
  }
  return join(
    app.getAppPath(),
    'node_modules',
    'electron-sparkle-updater',
    'native',
    'build',
    'Release',
    ADDON_FILE,
  )
}

export function loadSparkleBridgeForApp(
  log?: (message: string) => void,
): SparkleBridge | null {
  return loadSparkleBridge({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    addonPath: resolveAddonPath(),
    log,
  })
}
