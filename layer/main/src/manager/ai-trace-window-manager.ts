import { app, BrowserWindow } from 'electron'

import { BridgeService } from '~/services/bridge-service'
import { getAiTraceSink } from '~/services/torrent-ai/trace'
import type { WindowContentLoader } from '~/types/window-manager.types'
import {
  restoreNamedWindowState,
  trackNamedWindowState,
} from '~/utils/window-state'

import { DefaultWindowContentLoader } from './content-loader'

export class AiTraceWindowManager {
  private static instance: AiTraceWindowManager | null = null
  private window: BrowserWindow | null = null
  private readonly contentLoader: WindowContentLoader

  private constructor(contentLoader?: WindowContentLoader) {
    this.contentLoader
      = contentLoader
        ?? new DefaultWindowContentLoader({
          isDevelopment:
          process.env.NODE_ENV === 'development' || !app.isPackaged,
        })
  }

  static getInstance(
    contentLoader?: WindowContentLoader,
  ): AiTraceWindowManager {
    if (!this.instance) {
      this.instance = new AiTraceWindowManager(contentLoader)
    }
    return this.instance
  }

  async show(): Promise<BrowserWindow> {
    if (this.window && !this.window.isDestroyed()) {
      this.window.show()
      this.window.focus()
      return this.window
    }

    const isMacOS = process.platform === 'darwin'
    const restored = restoreNamedWindowState('ai-trace', {
      defaultWidth: 1100,
      defaultHeight: 720,
      minWidth: 800,
      minHeight: 520,
    })

    const win = new BrowserWindow({
      ...restored.bounds,
      minWidth: 800,
      minHeight: 520,
      show: false,
      autoHideMenuBar: true,
      title: 'AI Trace',
      titleBarStyle: isMacOS ? 'hiddenInset' : 'default',
      trafficLightPosition: { x: 16, y: 16 },
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.contentLoader.getPreloadPath(),
      },
    })

    this.window = win
    BridgeService.shared.registerWindow(win)
    getAiTraceSink().setBroadcastEnabled(true)
    trackNamedWindowState(win, 'ai-trace', {
      defaultWidth: 1100,
      defaultHeight: 720,
      minWidth: 800,
      minHeight: 520,
    })

    win.on('ready-to-show', () => {
      if (win.isDestroyed()) {
        return
      }
      if (restored.isMaximized) {
        win.maximize()
      }
      win.show()
    })
    win.on('closed', () => {
      if (this.window === win) {
        this.window = null
      }
    })

    if (this.contentLoader.isDevelopment) {
      const devUrl = (
        this.contentLoader as DefaultWindowContentLoader
      ).getDevServerUrl()
      await win.loadURL(`${devUrl}/trace.html`)
    }
    else {
      const indexPath = this.contentLoader.getProductionIndexPath()
      await win.loadFile(indexPath.replace(/index\.html$/, 'trace.html'))
    }

    return win
  }
}
