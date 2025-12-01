import { app, BrowserWindow, ipcMain, Menu, screen } from 'electron'

import { BridgeService } from '../services/bridge-service'
import type { WindowContentLoader } from '../types/window-manager.types'
import { t } from '../utils/i18n'
import {
  restoreNamedWindowState,
  trackNamedWindowState,
} from '../utils/window-state'
import { DefaultWindowContentLoader } from './content-loader'

export class FloatWindowManager {
  private static instance: FloatWindowManager | null = null
  private floatWindow: BrowserWindow | null = null
  private panelWindow: BrowserWindow | null = null
  private panelHover = false
  private contentLoader: WindowContentLoader
  private enableFloatingMode = true
  private showFloatOnClose = false
  private floatOrientation: 'left' | 'right' | 'top' = 'right'
  private isQuitting = false

  private readonly FLOAT_COMPACT = { width: 80, height: 80 }
  private readonly PANEL_SIZE = { width: 380, height: 320 }

  private constructor(contentLoader?: WindowContentLoader) {
    this.contentLoader =
      contentLoader ??
      new DefaultWindowContentLoader({
        isDevelopment:
          process.env.NODE_ENV === 'development' || !app.isPackaged,
      })

    // Set up app quit cleanup
    this.setupAppQuitHandlers()
  }

  static getInstance(contentLoader?: WindowContentLoader): FloatWindowManager {
    if (!FloatWindowManager.instance) {
      FloatWindowManager.instance = new FloatWindowManager(contentLoader)
    }
    return FloatWindowManager.instance
  }

  setFloatingMode(enabled: boolean): void {
    this.enableFloatingMode = enabled
    if (!enabled) this.hideFloatWindow()
  }
  getFloatingMode(): boolean {
    return this.enableFloatingMode
  }

  setShowFloatOnClose(enabled: boolean): void {
    this.showFloatOnClose = enabled
  }

  getShowFloatOnClose(): boolean {
    return this.showFloatOnClose
  }

  async handleMainWindowClose(): Promise<void> {
    // Don't show float window if app is quitting
    if (this.showFloatOnClose && !this.isQuitting) {
      await this.showFloatWindow()
    }
  }

  private setupAppQuitHandlers(): void {
    // Handle app quit to clean up all windows
    app.on('before-quit', () => {
      this.isQuitting = true

      // Destroy float and panel windows immediately to prevent them from blocking quit
      try {
        if (this.floatWindow && !this.floatWindow.isDestroyed()) {
          // Remove all listeners to prevent any handlers from interfering
          this.floatWindow.removeAllListeners()
          this.floatWindow.destroy()
          this.floatWindow = null
        }

        if (this.panelWindow && !this.panelWindow.isDestroyed()) {
          this.panelWindow.removeAllListeners()
          this.panelWindow.destroy()
          this.panelWindow = null
        }
      } catch (error) {
        console.error('Error during float window cleanup:', error)
        // Don't prevent quit even if cleanup fails
      }
    })

    // Additional cleanup on window-all-closed for non-macOS platforms
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        this.cleanup()
      }
    })
  }

  private cleanup(): void {
    this.isQuitting = true
    this.destroyFloatWindow()
    this.destroyPanelWindow()
  }

  async createFloatWindow(): Promise<BrowserWindow> {
    if (this.floatWindow && !this.floatWindow.isDestroyed()) {
      return this.floatWindow
    }

    // Don't create new windows if app is quitting
    if (this.isQuitting) {
      throw new Error('Cannot create float window while app is quitting')
    }

    const win = new BrowserWindow({
      width: this.FLOAT_COMPACT.width,
      height: this.FLOAT_COMPACT.height,
      resizable: false,
      movable: true,
      frame: false,
      transparent: true,
      hasShadow: false,
      roundedCorners: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      focusable: true,

      backgroundColor: '#00000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.contentLoader.getPreloadPath(),
        webSecurity: false,
        allowRunningInsecureContent: true,
      },
    })

    this.floatWindow = win
    BridgeService.shared.registerWindow(win)

    // Setup context menu
    this.setupFloatWindowContextMenu(win)

    const notifyOrientation = () => {
      this.floatWindow?.webContents.send(
        'float:orientation',
        this.floatOrientation,
      )
    }

    // Restore last position or use default near right edge
    const pb = screen.getPrimaryDisplay().workArea
    const defaultX = Math.round(
      pb.x + pb.width - (this.FLOAT_COMPACT.width + 8),
    )
    const defaultY = Math.round(
      pb.y + pb.height / 2 - this.FLOAT_COMPACT.height / 2,
    )
    const { bounds } = restoreNamedWindowState('float', {
      defaultWidth: this.FLOAT_COMPACT.width,
      defaultHeight: this.FLOAT_COMPACT.height,
      minWidth: this.FLOAT_COMPACT.width,
      minHeight: this.FLOAT_COMPACT.height,
    })
    const x = bounds.x ?? defaultX
    const y = bounds.y ?? defaultY
    win.setBounds({
      x,
      y,
      width: this.FLOAT_COMPACT.width,
      height: this.FLOAT_COMPACT.height,
    })
    // Infer initial orientation from position
    const ib = win.getBounds()
    const iwa = screen.getDisplayNearestPoint({ x: ib.x, y: ib.y }).workArea
    const leftDist = Math.abs(ib.x - iwa.x)
    const rightDist = Math.abs(iwa.x + iwa.width - (ib.x + ib.width))
    const topDist = Math.abs(ib.y - iwa.y)
    if (leftDist <= rightDist && leftDist <= topDist)
      this.floatOrientation = 'left'
    else if (rightDist < leftDist && rightDist <= topDist)
      this.floatOrientation = 'right'
    else this.floatOrientation = 'top'
    notifyOrientation()

    win.on('ready-to-show', () => {
      if (!win) return
      win.showInactive()
    })
    win.on('closed', () => {
      if (this.floatWindow === win) this.floatWindow = null
    })

    // Snap on move
    const debounced = this.debounce(() => {
      this.snapFloatWindowToEdge()
      notifyOrientation()
    }, 120)
    // Persist position/visibility for float window as it moves
    trackNamedWindowState(win, 'float', {
      defaultWidth: this.FLOAT_COMPACT.width,
      defaultHeight: this.FLOAT_COMPACT.height,
      minWidth: this.FLOAT_COMPACT.width,
      minHeight: this.FLOAT_COMPACT.height,
    })
    // Reposition panel in real time while moving
    win.on('move', () => {
      this.repositionPanelAlongFloat()
      debounced()
    })
    win.on('moved', debounced)

    // Load dedicated mini app entry (multi-app)
    try {
      if (this.contentLoader.isDevelopment) {
        const devUrl = (
          this.contentLoader as DefaultWindowContentLoader
        ).getDevServerUrl()
        await win.loadURL(`${devUrl}/mini.html`)
      } else {
        const indexPath = this.contentLoader.getProductionIndexPath()
        const miniPath = indexPath.replace(/index\.html$/, 'mini.html')
        await win.loadFile(miniPath)
      }
    } catch (error) {
      console.error('Failed to load float window content:', error)
    }

    return win
  }

  async showFloatWindow(): Promise<void> {
    // Don't create/show windows if app is quitting
    if (this.isQuitting) return

    const win = await this.createFloatWindow()
    if (!win.isVisible()) win.showInactive()
  }
  hideFloatWindow(): void {
    if (this.floatWindow && !this.floatWindow.isDestroyed())
      this.floatWindow.hide()
    // Also hide the panel when bubble is explicitly hidden
    this.hidePanelWindow()
  }
  destroyFloatWindow(): void {
    if (this.floatWindow && !this.floatWindow.isDestroyed()) {
      if (!this.isQuitting) {
        this.floatWindow.removeAllListeners()
      }
      this.floatWindow.destroy()
      this.floatWindow = null
    }
  }

  destroyPanelWindow(): void {
    if (this.panelWindow && !this.panelWindow.isDestroyed()) {
      if (!this.isQuitting) {
        this.panelWindow.removeAllListeners()
      }
      this.panelWindow.destroy()
      this.panelWindow = null
    }
  }
  async toggleFloatWindow(): Promise<void> {
    if (!this.floatWindow || this.floatWindow.isDestroyed()) {
      await this.showFloatWindow()
      return
    }
    if (this.floatWindow.isVisible()) this.floatWindow.hide()
    else this.floatWindow.showInactive()
  }

  private debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
    let t: ReturnType<typeof setTimeout> | undefined
    return (...args: Parameters<T>) => {
      if (t) clearTimeout(t)
      t = setTimeout(() => fn(...args), ms)
    }
  }

  private snapFloatWindowToEdge(): void {
    if (!this.floatWindow) return

    const win = this.floatWindow
    const b = win.getBounds()
    const wa = screen.getDisplayNearestPoint({ x: b.x, y: b.y }).workArea
    const snap = 40

    const leftDist = Math.abs(b.x - wa.x)
    const rightDist = Math.abs(wa.x + wa.width - (b.x + b.width))
    const topDist = Math.abs(b.y - wa.y)

    let { x } = b
    let { y } = b
    let orientation: 'left' | 'right' | 'top' = this.floatOrientation

    if (leftDist <= rightDist && leftDist < snap) {
      x = wa.x
      orientation = 'left'
    } else if (rightDist < leftDist && rightDist < snap) {
      x = wa.x + wa.width - b.width
      orientation = 'right'
    } else if (topDist < snap) {
      y = wa.y
      orientation = 'top'
    }

    if (x !== b.x || y !== b.y) win.setBounds({ ...b, x, y })
    this.floatOrientation = orientation
  }

  async expandFloatWindow(): Promise<void> {
    // Show bottom panel instead of resizing bubble
    await this.showPanelWindow()
  }

  private async createPanelWindow(): Promise<BrowserWindow> {
    if (this.panelWindow && !this.panelWindow.isDestroyed())
      return this.panelWindow

    // Don't create new windows if app is quitting
    if (this.isQuitting) {
      throw new Error('Cannot create panel window while app is quitting')
    }

    const isMac = process.platform === 'darwin'
    const panel = new BrowserWindow({
      width: this.PANEL_SIZE.width,
      height: this.PANEL_SIZE.height,
      resizable: false,
      movable: true,
      frame: false,
      // Use opaque window; simulate background/blur/shadow via CSS in renderer
      transparent: true,
      hasShadow: false,
      roundedCorners: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      focusable: true,
      // Disable system vibrancy/blur; renderer provides visual styling
      vibrancy: undefined,
      visualEffectState: isMac ? 'inactive' : undefined,
      backgroundColor: '#00000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.contentLoader.getPreloadPath(),
        webSecurity: false,
        allowRunningInsecureContent: true,
      },
    })
    this.panelWindow = panel
    BridgeService.shared.registerWindow(panel)

    // Listen for hover state from panel renderer
    const hoverHandler = (e: Electron.IpcMainEvent, hovering: boolean) => {
      if (e.sender.id !== panel.webContents.id) return
      this.panelHover = hovering
      this.floatWindow?.webContents.send('panel:hover-state', hovering)
    }
    ipcMain.on('panel:hover', hoverHandler)

    try {
      if (this.contentLoader.isDevelopment) {
        const devUrl = (
          this.contentLoader as DefaultWindowContentLoader
        ).getDevServerUrl()
        await panel.loadURL(`${devUrl}/panel.html`)
      } else {
        const indexPath = this.contentLoader.getProductionIndexPath()
        const panelPath = indexPath.replace(/index\.html$/, 'panel.html')
        await panel.loadFile(panelPath)
      }
    } catch (error) {
      console.error('Failed to load panel content:', error)
    }

    panel.on('closed', () => {
      if (this.panelWindow === panel) this.panelWindow = null
      ipcMain.removeListener('panel:hover', hoverHandler)
    })

    return panel
  }

  public async showPanelWindow(): Promise<void> {
    // Don't create/show windows if app is quitting
    if (this.isQuitting) return

    const panel = await this.createPanelWindow()
    this.repositionPanelAlongFloat(panel)

    if (!panel.isVisible()) panel.showInactive()

    panel.webContents.send('panel:enter')
    this.floatWindow?.webContents.send('panel:state', true)
  }

  public hidePanelWindow(checkCursor = false): void {
    if (this.panelWindow && !this.panelWindow.isDestroyed()) {
      if (checkCursor) {
        const cursor = screen.getCursorScreenPoint()
        const b = this.panelWindow.getBounds()
        const inside =
          cursor.x >= b.x &&
          cursor.x <= b.x + b.width &&
          cursor.y >= b.y &&
          cursor.y <= b.y + b.height
        if (inside) return
      }
      this.panelWindow.webContents.send('panel:exit')

      // Hide after animation completes
      const ref = this.panelWindow
      setTimeout(() => {
        if (!ref.isDestroyed()) ref.hide()

        this.floatWindow?.webContents.send('panel:state', false)
        this.floatWindow?.webContents.send('panel:hover-state', false)
      }, 220)
    }
  }

  // Removed scheduleHidePanel logic per design

  private setupFloatWindowContextMenu(win: BrowserWindow): void {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: t('floatWindow.hide'),
        click: () => {
          this.hideFloatWindow()
        },
      },
      {
        label: t('floatWindow.exit'),
        click: () => {
          app.quit()
        },
      },
    ])

    win.webContents.on('context-menu', () => {
      contextMenu.popup({ window: win })
    })
  }

  // Public so drag service can call it while polling
  public repositionPanelAlongFloat(targetPanel?: BrowserWindow | null): void {
    const panel = targetPanel ?? this.panelWindow
    if (!panel || panel.isDestroyed()) return

    // Position directly below the bubble window, centered horizontally
    const ref = this.floatWindow
    const wa = ref
      ? screen.getDisplayNearestPoint(ref.getBounds()).workArea
      : screen.getPrimaryDisplay().workArea

    const gap = 8
    const b = ref
      ? ref.getBounds()
      : { x: wa.x + wa.width / 2, y: wa.y, width: 0, height: 0 }
    let x = Math.round(b.x + b.width / 2 - this.PANEL_SIZE.width / 2)
    let y = Math.round(b.y + b.height + gap)

    // Clamp within work area while keeping it below bubble
    x = Math.min(Math.max(x, wa.x), wa.x + wa.width - this.PANEL_SIZE.width)
    y = Math.min(
      Math.max(y, wa.y),
      wa.y + wa.height - this.PANEL_SIZE.height - 4,
    )

    const pb = panel.getBounds()
    if (pb.x !== x || pb.y !== y) {
      panel.setBounds(
        { x, y, width: this.PANEL_SIZE.width, height: this.PANEL_SIZE.height },
        true,
      )
    }
  }

  // Removed custom save/load; using shared window-state utilities
}
