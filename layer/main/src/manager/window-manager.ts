import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { app, BrowserWindow, dialog, shell } from 'electron'

import { getUpdateDir } from '~/config/paths'
import { isDevelopment } from '~/constants'
import { isHttpLike } from '~/utils/_'

import { BridgeService } from '../services/bridge-service'
import type {
  IWindowManager,
  WindowContentLoader,
  WindowManagerOptions,
} from '../types/window-manager.types'
import { restoreWindowState, trackWindowState } from '../utils/window-state'
import { DefaultWindowContentLoader } from './content-loader'
// import { FloatWindowManager } from './float-window-manager'
import { HotUpdateContentLoader } from './hot-content-loader'

export class WindowManager implements IWindowManager {
  private static instance: WindowManager | null = null
  private mainWindow: BrowserWindow | null = null
  // Float window moved to FloatWindowManager
  private contentLoader: WindowContentLoader
  private isUsingHotUpdateLoader = false
  private baseContentLoader: DefaultWindowContentLoader | null = null
  private options: Required<
    Omit<
      WindowManagerOptions,
      'contentLoader' | 'onWindowReady' | 'onWindowClosed'
    >
  > & {
    onWindowReady?: (window: BrowserWindow) => void
    onWindowClosed?: () => void
  }
  private isInitialized = false

  private currentRendererInfo: {
    source: 'dev' | 'hot-update' | 'bundled'
    version?: string | null
    pathOrUrl?: string
  } | null = null

  private enableFloatingMode = true
  // private floatManager: FloatWindowManager

  private constructor(options: WindowManagerOptions = {}) {
    const defaultLoader = new DefaultWindowContentLoader({
      isDevelopment: process.env.NODE_ENV === 'development' || !app.isPackaged,
    })

    this.contentLoader = options.contentLoader ?? defaultLoader
    this.baseContentLoader = defaultLoader

    // Detect if we're using HotUpdateContentLoader
    this.isUsingHotUpdateLoader =
      this.contentLoader instanceof HotUpdateContentLoader
    const isMacOS = process.platform === 'darwin'

    this.options = {
      enableDevTools: this.contentLoader.isDevelopment,
      ...options,
      windowOptions: {
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        show: false, // Don't show until ready-to-show
        autoHideMenuBar: true,
        trafficLightPosition: {
          x: 16,
          y: 16,
        },
        vibrancy: isMacOS ? 'sidebar' : undefined,
        transparent: isMacOS,
        titleBarStyle: isMacOS ? 'hiddenInset' : 'default',
        ...options.windowOptions,
        webPreferences: {
          ...options.windowOptions?.webPreferences,

          nodeIntegration: false,
          contextIsolation: true,
          preload: this.contentLoader.getPreloadPath(),
          // webSecurity: false, // 完全禁用 web 安全限制以解决 CORS 问题
          // allowRunningInsecureContent: true, // 允许不安全内容
        },
      },
    }
    // this.floatManager = FloatWindowManager.getInstance(this.contentLoader)
    this.isInitialized = true
  }

  /**
   * Get the singleton instance of WindowManager
   */
  static getInstance(options?: WindowManagerOptions): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager(options)
    } else if (options && !WindowManager.instance.isInitialized) {
      // If instance exists but not initialized, reinitialize with new options
      WindowManager.instance = new WindowManager(options)
    }
    return WindowManager.instance
  }

  /**
   * Reset the singleton instance (for testing purposes)
   */
  static resetInstance(): void {
    if (WindowManager.instance) {
      WindowManager.instance.destroyMainWindow()
      WindowManager.instance = null
    }
  }

  /**
   * Create the main application window
   */
  async createMainWindow(iconPath?: string | null): Promise<BrowserWindow> {
    if (this.mainWindow) {
      return this.mainWindow
    }

    // Add icon to window options if provided (for Windows/Linux)
    const windowOptions = { ...this.options.windowOptions }
    // Restore last window position/size safely within current displays
    try {
      const { bounds, isMaximized } = restoreWindowState({
        defaultWidth: windowOptions.width ?? 1400,
        defaultHeight: windowOptions.height ?? 900,
        minWidth: windowOptions.minWidth,
        minHeight: windowOptions.minHeight,
      })
      windowOptions.x = bounds.x
      windowOptions.y = bounds.y
      windowOptions.width = bounds.width
      windowOptions.height = bounds.height
      // Apply maximized state after creation below
      ;(windowOptions as any).__shouldMaximize = isMaximized
    } catch (e) {
      console.warn('Failed to restore window state; using defaults.', e)
    }
    if (iconPath && process.platform !== 'darwin') {
      windowOptions.icon = iconPath
    }

    this.mainWindow = new BrowserWindow(windowOptions)
    BridgeService.shared.registerWindow(this.mainWindow)

    // Handle window ready-to-show
    this.mainWindow.once('ready-to-show', () => {
      if (!this.mainWindow) return

      if (this.options.enableDevTools && this.contentLoader.isDevelopment) {
        this.mainWindow.webContents.openDevTools()
      }

      this.options.onWindowReady?.(this.mainWindow)
    })

    // Start tracking and persist state changes
    trackWindowState(this.mainWindow, {
      defaultWidth: windowOptions.width ?? 1400,
      defaultHeight: windowOptions.height ?? 900,
      minWidth: windowOptions.minWidth,
      minHeight: windowOptions.minHeight,
    })

    // Restore maximized state after content is ready
    const shouldMaximize = (windowOptions as any).__shouldMaximize === true
    if (shouldMaximize) {
      this.mainWindow.once('ready-to-show', () => {
        if (!this.mainWindow) return
        this.mainWindow.maximize()
      })
    }

    // // When main is shown or focused, hide the float window
    // this.mainWindow.on('show', () => this.floatManager.hideFloatWindow())
    // this.mainWindow.on('focus', () => this.floatManager.hideFloatWindow())

    // // When main is minimized or hidden, show the float window
    // this.mainWindow.on('minimize', () => {
    //   if (this.enableFloatingMode) void this.floatManager.showFloatWindow()
    // })
    // this.mainWindow.on('hide', () => {
    //   if (this.enableFloatingMode) void this.floatManager.showFloatWindow()
    // })

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null
      this.options.onWindowClosed?.()
      // When the main window is closed, show the floating window if setting is enabled
      // void this.floatManager.handleMainWindowClose()
    })

    if (this.contentLoader.isDevelopment) {
      await this.loadDebugWindowContent()
    } else {
      await this.loadWindowContent()
    }

    this.handleWindowOpenLink(this.mainWindow)
    return this.mainWindow
  }

  /**
   * Destroy the main window
   */
  destroyMainWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.destroy()
      this.mainWindow = null
    }
  }

  /**
   * Get the main window instance
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  /**
   * Check if main window is created
   */
  isMainWindowCreated(): boolean {
    return this.mainWindow !== null
  }

  /**
   * Show the main window
   */
  async showMainWindow(): Promise<void> {
    if (this.mainWindow) {
      this.mainWindow.show()
      // this.floatManager.hideFloatWindow()
    } else {
      const win = await this.createMainWindow()
      win.show()
      win.focus()
    }
  }

  /**
   * Hide the main window
   */
  hideMainWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.hide()
    }
  }

  /**
   * Focus the main window
   */
  focusMainWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore()
      }
      this.mainWindow.focus()
      // this.floatManager.hideFloatWindow()
    }
  }

  /**
   * Minimize the main window
   */
  minimizeMainWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.minimize()
    }
  }

  /**
   * Maximize the main window
   */
  maximizeMainWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.maximize()
    }
  }

  /**
   * Toggle maximize/unmaximize the main window
   */
  toggleMaximizeMainWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize()
      } else {
        this.mainWindow.maximize()
      }
    }
  }

  /**
   * Close the main window
   */
  closeMainWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.close()
    }
  }

  /**
   * Handle app activation (macOS)
   */
  handleAppActivation(): void {
    app.on('activate', async () => {
      // macOS: when Dock icon is clicked show existing window or create it
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        await this.createMainWindow()
        return
      }

      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore()
      }
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show()
      }

      this.mainWindow.focus()
    })
  }

  /**
   * Handle window close behavior
   */
  handleWindowClose(): void {
    app.on('window-all-closed', () => {
      // On macOS, keep app running even when all windows are closed
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })

    app.on('before-quit', () => {
      // Perform cleanup before quitting
      console.info('Application is quitting...')
      const windows = BrowserWindow.getAllWindows()
      windows.forEach((window) => window.destroy())

      if (isDevelopment) {
        console.info('Clean app cache...')
        const cacheDir = join(app.getPath('userData'), 'Cache')
        const codeCacheDir = join(app.getPath('userData'), 'Code Cache')

        rmSync(cacheDir, { recursive: true, force: true })
        rmSync(codeCacheDir, { recursive: true, force: true })
      }
    })
  }

  private handleWindowOpenLink(win: BrowserWindow): void {
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (isHttpLike(url)) {
        shell.openExternal(url) // 调系统浏览器
        return { action: 'deny' } // 阻止新 Electron 窗口
      }
      // 若要允许站内（自定义协议、file://）再打开新窗口，可在此按需判断
      return { action: 'deny' }
    })

    // 可选：拦截页面内的跨站跳转（比如某些站点用 window.location 直接跳到外链）
    win.webContents.on('will-navigate', (event, url) => {
      // 如果你的应用是单页（内路由）且不希望跳出应用，可以做如下处理
      if (isHttpLike(url) && url !== win.webContents.getURL()) {
        event.preventDefault()
        shell.openExternal(url)
      }
    })
  }

  /**
   * Load content into the main window based on environment
   */
  private async loadWindowContent(): Promise<void> {
    if (!this.mainWindow) return

    try {
      if (this.contentLoader.isDevelopment) {
        // Development: Load from Vite dev server
        const devUrl = (
          this.contentLoader as DefaultWindowContentLoader
        ).getDevServerUrl()
        console.info(`Loading development server: ${devUrl}`)

        // Wait for dev server to be ready
        await (
          this.contentLoader as DefaultWindowContentLoader
        ).waitForDevServer()
        await this.mainWindow.loadURL(devUrl)
        this.currentRendererInfo = {
          source: 'dev',
          version: null,
          pathOrUrl: devUrl,
        }
      } else {
        // Production: Load from dist directory
        const indexPath = this.contentLoader.getProductionIndexPath()
        console.info(`Loading production build: ${indexPath}`)
        await this.mainWindow.loadFile(indexPath)
        // Determine if hot-update or bundled
        const updatesDir = getUpdateDir()
        const normalized = indexPath.replaceAll('\\', '/')
        const normalizedUpdates = updatesDir.replaceAll('\\', '/')
        if (normalized.startsWith(normalizedUpdates)) {
          const rest = normalized.slice(normalizedUpdates.length + 1)
          const ver = rest.split('/')[0] || null
          this.currentRendererInfo = {
            source: 'hot-update',
            version: ver,
            pathOrUrl: indexPath,
          }
        } else {
          this.currentRendererInfo = {
            source: 'bundled',
            version: null,
            pathOrUrl: indexPath,
          }
        }
      }
    } catch (error) {
      console.error('Failed to load window content:', error)
      await this.showErrorDialog(
        'Loading Error',
        `Failed to load application: ${error}`,
      )
    }
  }
  /**
   * Load content into the main window based on environment
   */
  private async loadDebugWindowContent(): Promise<void> {
    if (!this.mainWindow) return

    if (!this.contentLoader.isDevelopment) {
      console.error(
        'debug window content is only available in development mode',
      )
      return
    }

    try {
      if (this.isUsingHotUpdateLoader) {
        // Production: Load from dist directory
        const indexPath = this.contentLoader.getProductionIndexPath()
        console.info(`Loading production build: ${indexPath}`)
        await this.mainWindow.loadFile(indexPath)
        const updatesDir = getUpdateDir()
        const normalized = indexPath.replaceAll('\\', '/')
        const normalizedUpdates = updatesDir.replaceAll('\\', '/')
        if (normalized.startsWith(normalizedUpdates)) {
          const rest = normalized.slice(normalizedUpdates.length + 1)
          const ver = rest.split('/')[0] || null
          this.currentRendererInfo = {
            source: 'hot-update',
            version: ver,
            pathOrUrl: indexPath,
          }
        } else {
          this.currentRendererInfo = {
            source: 'bundled',
            version: null,
            pathOrUrl: indexPath,
          }
        }
      } else {
        // Development: Load from Vite dev server
        const devUrl = (
          this.contentLoader as DefaultWindowContentLoader
        ).getDevServerUrl()
        console.info(`Loading development server: ${devUrl}`)
        await this.mainWindow.loadURL(devUrl)
        this.currentRendererInfo = {
          source: 'dev',
          version: null,
          pathOrUrl: devUrl,
        }
      }
    } catch (error) {
      console.error('Failed to load window content:', error)
      await this.showErrorDialog(
        'Loading Error',
        `Failed to load application: ${error}`,
      )
    }
  }

  /**
   * Switch between DefaultWindowContentLoader and HotUpdateContentLoader
   * Only works in development mode
   */
  public async switchContentLoader(): Promise<void> {
    if (!this.contentLoader.isDevelopment) {
      console.warn(
        'Content loader switching is only available in development mode',
      )
      return
    }

    if (!this.baseContentLoader) {
      console.warn('Base content loader not available')
      return
    }

    try {
      // Create the appropriate content loader
      const newLoader = this.isUsingHotUpdateLoader
        ? this.baseContentLoader
        : new HotUpdateContentLoader(this.baseContentLoader)

      // Update the content loader
      this.contentLoader = newLoader
      this.isUsingHotUpdateLoader = !this.isUsingHotUpdateLoader

      // Update window options with new preload path
      if (this.mainWindow && this.options.windowOptions.webPreferences) {
        this.options.windowOptions.webPreferences.preload =
          newLoader.getPreloadPath()
      }

      // Reload the window content with new loader
      await this.reloadWindowContent()

      const loaderType = this.isUsingHotUpdateLoader
        ? 'HotUpdateContentLoader'
        : 'DefaultWindowContentLoader'

      console.info(`Switched to ${loaderType}`)
    } catch (error) {
      console.error('Failed to switch content loader:', error)
    }
  }

  /**
   * Reload the window content using the current content loader
   */
  public async reloadWindowContent(): Promise<void> {
    if (!this.mainWindow) {
      console.warn('No main window available for content reload')
      return
    }

    try {
      if (this.contentLoader.isDevelopment) {
        await this.loadDebugWindowContent()
      } else {
        await this.loadWindowContent()
      }
    } catch (error) {
      console.error('Failed to reload window content:', error)
      // Fallback to simple reload if loadWindowContent fails
      this.mainWindow.reload()
    }
  }

  /**
   * Force reload ignoring cache
   */
  public forceReloadWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.reloadIgnoringCache()
    }
  }

  /**
   * Get the current content loader type
   */
  public getCurrentContentLoaderType(): string {
    return this.isUsingHotUpdateLoader
      ? 'HotUpdateContentLoader'
      : 'DefaultWindowContentLoader'
  }

  public getRendererInfo(): {
    source: 'dev' | 'hot-update' | 'bundled'
    version?: string | null
  } | null {
    return this.currentRendererInfo
  }

  /**
   * Check if currently using hot update loader
   */
  public isUsingHotUpdate(): boolean {
    return this.isUsingHotUpdateLoader
  }

  /**
   * Show error dialog to user
   */
  private async showErrorDialog(title: string, content: string): Promise<void> {
    dialog.showErrorBox(title, content)
  }
}
