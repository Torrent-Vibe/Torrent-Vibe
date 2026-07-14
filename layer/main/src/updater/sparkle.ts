import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { app } from 'electron'

export interface SparkleInitOptions {
  appcastUrl: string
  publicEdKey: string
}

export interface SparkleBridge {
  init: (options: SparkleInitOptions) => boolean
  checkForUpdates: () => void
  installUpdateNow: () => void
  setAutomaticChecks: (enabled: boolean) => void
}

interface SparkleBridgeLoadDeps {
  isPackaged: boolean
  resourcesPath: string
  moduleUrl: string
  log?: (message: string) => void
}

const ADDON_RELATIVE_PATH = join(
  'native',
  'sparkle-bridge',
  'build',
  'Release',
  'sparkle_bridge.node',
)

export function resolveSparkleAddonPath(deps: SparkleBridgeLoadDeps): string {
  if (deps.isPackaged) {
    // electron-forge's asar unpacks native binaries under app.asar.unpacked with the
    // project-relative layout preserved, so the addon keeps its native/ prefix.
    return join(deps.resourcesPath, 'app.asar.unpacked', ADDON_RELATIVE_PATH)
  }
  // Dev bundle lives at <root>/dist/main; the native addon sits at <root>/native.
  const here = dirname(fileURLToPath(deps.moduleUrl))
  return join(here, '..', '..', ADDON_RELATIVE_PATH)
}

export function loadSparkleBridge(
  deps: SparkleBridgeLoadDeps,
): SparkleBridge | null {
  const addonPath = resolveSparkleAddonPath(deps)
  try {
    const require = createRequire(deps.moduleUrl)
    const addon = require(addonPath) as SparkleBridge
    if (
      typeof addon.init !== 'function'
      || typeof addon.checkForUpdates !== 'function'
      || typeof addon.installUpdateNow !== 'function'
      || typeof addon.setAutomaticChecks !== 'function'
    ) {
      deps.log?.(
        'addon loaded but missing expected exports, treating as unavailable',
      )
      return null
    }
    return addon
  }
  catch (err) {
    deps.log?.(`addon load failed: ${(err as Error).message}`)
    return null
  }
}

export function loadSparkleBridgeForApp(
  log?: (message: string) => void,
): SparkleBridge | null {
  return loadSparkleBridge({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    moduleUrl: import.meta.url,
    log,
  })
}
