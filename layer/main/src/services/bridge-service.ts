import type { BrowserWindow } from 'electron'
import log from 'electron-log'

import type { BridgeEventData, BridgeEventName } from '../@types/bridge-events'

export class BridgeService {
  private static _instance: BridgeService
  private windows = new Set<BrowserWindow>()
  private logger = log.scope('BridgeService')

  private constructor() {}

  static get shared(): BridgeService {
    if (!this._instance) {
      this._instance = new BridgeService()
    }
    return this._instance
  }

  registerWindow(window: BrowserWindow): void {
    this.windows.add(window)
    window.on('closed', () => {
      this.windows.delete(window)
    })
  }

  broadcast<T extends BridgeEventName>(
    eventName: T,
    data: BridgeEventData<T>,
  ): void {
    for (const win of Array.from(this.windows)) {
      if (win.isDestroyed()) {
        this.windows.delete(win)
        continue
      }
      win.webContents.send(eventName, data)
    }
    this.logger.debug('broadcast', eventName, data)
  }
}
