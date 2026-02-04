import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

import { app } from 'electron'
import { join } from 'pathe'

import { getLogger } from '../config/log-config'
import { WindowManager } from './window-manager'

// Use createRequire to load koffi (CommonJS module) in ESM context
const require = createRequire(import.meta.url)

const koffi = require('koffi')

const logger = getLogger('MenubarSpeedManager')

// Define callback type once at module level to avoid duplicates
let CallbackType: ReturnType<typeof koffi.proto> | null = null
const getCallbackType = () => {
  if (!CallbackType) {
    CallbackType = koffi.proto('void MenuCallback()')
  }
  return CallbackType
}

export interface SpeedData {
  download: number
  upload: number
  progress: number // Overall progress percentage (0-100), -1 if no active downloads
}

// FFI function types
type MenubarSpeedInit = () => boolean
type MenubarSpeedUpdate = (
  download: bigint,
  upload: bigint,
  progress: number,
) => void
type MenubarSpeedDestroy = () => void
type MenubarSpeedSetCallback = (callback: unknown) => void

export class MenubarSpeedManager {
  private static _instance: MenubarSpeedManager | null = null
  static get instance(): MenubarSpeedManager {
    if (!this._instance) this._instance = new MenubarSpeedManager()
    return this._instance
  }

  private lib: ReturnType<typeof koffi.load> | null = null
  private isEnabled = false

  // FFI functions
  private ffiInit: MenubarSpeedInit | null = null
  private ffiUpdate: MenubarSpeedUpdate | null = null
  private ffiDestroy: MenubarSpeedDestroy | null = null
  private ffiSetShowCallback: MenubarSpeedSetCallback | null = null
  private ffiSetQuitCallback: MenubarSpeedSetCallback | null = null

  // Keep references to prevent GC
  private showCallbackRef: unknown = null
  private quitCallbackRef: unknown = null

  private getLibraryPath(): string | null {
    const possiblePaths = [
      // Development: built dylib in native folder
      join(app.getAppPath(), 'native/menubar-speed/libmenubar_speed.dylib'),
      // Production: bundled in resources
      join(process.resourcesPath ?? '', 'libmenubar_speed.dylib'),
      // Fallback: relative to app path
      join(app.getAppPath(), '..', 'libmenubar_speed.dylib'),
    ]

    for (const p of possiblePaths) {
      if (existsSync(p)) {
        return p
      }
    }

    return null
  }

  initialize(): void {
    logger.info('MenubarSpeedManager.initialize() called')

    if (process.platform !== 'darwin') {
      logger.info('Menubar speed display is only supported on macOS')
      return
    }

    // Already enabled, nothing to do
    if (this.isEnabled) {
      logger.info('Menubar speed already enabled')
      return
    }

    // If lib is already loaded (from previous init), just re-initialize menubar
    if (this.lib && this.ffiInit) {
      const success = this.ffiInit()
      if (success) {
        this.isEnabled = true
        logger.info('Menubar speed display re-initialized')
      }
      return
    }

    const libPath = this.getLibraryPath()
    logger.info(`Looking for dylib, found: ${libPath}`)

    if (!libPath) {
      logger.warn('Menubar speed library not found')
      logger.info(
        `Searched paths: ${[
          join(app.getAppPath(), 'native/menubar-speed/libmenubar_speed.dylib'),
          join(process.resourcesPath ?? '', 'libmenubar_speed.dylib'),
          join(app.getAppPath(), '..', 'libmenubar_speed.dylib'),
        ].join(', ')}`,
      )
      return
    }

    try {
      // Load the Swift dynamic library
      this.lib = koffi.load(libPath)

      // Get callback type (defined once at module level)
      const cbType = getCallbackType()

      // Bind FFI functions
      this.ffiInit = this.lib.func('bool menubar_speed_init()')
      this.ffiUpdate = this.lib.func(
        'void menubar_speed_update(int64_t downloadSpeed, int64_t uploadSpeed, double progress)',
      )
      this.ffiDestroy = this.lib.func('void menubar_speed_destroy()')
      this.ffiSetShowCallback = this.lib.func(
        'void menubar_speed_set_show_callback(MenuCallback* callback)',
      )
      this.ffiSetQuitCallback = this.lib.func(
        'void menubar_speed_set_quit_callback(MenuCallback* callback)',
      )

      // Register callbacks
      this.showCallbackRef = koffi.register(() => {
        logger.info('Show callback triggered')
        WindowManager.getInstance().showMainWindow()
      }, koffi.pointer(cbType))

      this.quitCallbackRef = koffi.register(() => {
        logger.info('Quit callback triggered')
        app.quit()
      }, koffi.pointer(cbType))

      // Set callbacks
      this.ffiSetShowCallback?.(this.showCallbackRef)
      this.ffiSetQuitCallback?.(this.quitCallbackRef)

      // Initialize the menubar
      const success = this.ffiInit?.()
      if (success) {
        this.isEnabled = true
        logger.info('Menubar speed display initialized via FFI')
      } else {
        logger.error('Failed to initialize menubar speed display')
      }
    } catch (error) {
      logger.error('Failed to load menubar speed library:', error)
    }
  }

  updateSpeed(data: SpeedData): void {
    if (!this.ffiUpdate || !this.isEnabled) {
      return
    }

    try {
      this.ffiUpdate(BigInt(data.download), BigInt(data.upload), data.progress)
    } catch (error) {
      logger.error('Failed to update speed:', error)
    }
  }

  stop(): void {
    if (!this.isEnabled) {
      return
    }

    if (this.ffiDestroy) {
      try {
        this.ffiDestroy()
      } catch (error) {
        logger.error('Failed to destroy menubar:', error)
      }
    }

    // Note: We don't unload lib or unregister callbacks here
    // because React Strict Mode may call stop() then initialize() again
    // and koffi doesn't allow redefining types
    this.isEnabled = false

    logger.info('Menubar speed display stopped')
  }

  destroy(): void {
    this.stop()
  }
}
