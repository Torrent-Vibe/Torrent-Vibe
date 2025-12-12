import { app, dialog } from 'electron'

import { configureLogging, logSystemInfo } from './config/log-config'
import { initializeServices, services } from './ipc/services'
import { AppMenuManager } from './manager/app-menu'
import { DefaultWindowContentLoader } from './manager/content-loader'
import { DeeplinkManager } from './manager/deeplink-manager'
import { FileOpenManager } from './manager/file-open-manager'
import { HotUpdateContentLoader } from './manager/hot-content-loader'
import { IconManager } from './manager/icon-manager'
import { RendererLifecycleManager } from './manager/renderer-lifecycle'
import { SessionManager } from './manager/session-manager'
import { SingleInstanceManager } from './manager/single-instance-manager'
import { WindowManager } from './manager/window-manager'
import { UpdateService } from './services/update-service'
import type { WindowManagerOptions } from './types/window-manager.types'

interface BootstrapOptions {
  // Development server configuration
  devServerPort?: number
  devServerHost?: string

  // Window configuration
  windowOptions?: Electron.BrowserWindowConstructorOptions

  // Application configuration
  enableDevTools?: boolean
  enableSingleInstance?: boolean
}

class ElectronBootstrap {
  private windowManager: WindowManager
  private isDevelopment: boolean
  private options: Required<BootstrapOptions>
  private windowIconPath: string | null = null

  constructor(options: BootstrapOptions = {}) {
    // Enforce disabling CORS / web security at the Chromium level (main-process only).
    // This keeps renderer code untouched and avoids IPC/proxy complexity.
    app.commandLine.appendSwitch('disable-web-security')
    app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors')

    this.isDevelopment =
      process.env.NODE_ENV === 'development' || !app.isPackaged

    this.options = {
      devServerPort: 5173, // Default Vite dev server port
      devServerHost: 'localhost',
      enableDevTools: this.isDevelopment,
      enableSingleInstance: true,
      ...options,
      windowOptions: {
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 600,
        show: false,
        autoHideMenuBar: true,
        titleBarStyle:
          process.platform === 'darwin' ? 'hiddenInset' : 'default',
        ...options.windowOptions,
        webPreferences: {
          ...options.windowOptions?.webPreferences,
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false, // 完全禁用 web 安全限制以解决 CORS 问题
          allowRunningInsecureContent: true, // 允许不安全内容
        },
      },
    }

    // Initialize WindowManager singleton with content loader
    const baseLoader = new DefaultWindowContentLoader({
      isDevelopment: this.isDevelopment,
      devServerPort: this.options.devServerPort,
      devServerHost: this.options.devServerHost,
    })
    const contentLoader = this.isDevelopment
      ? baseLoader
      : new HotUpdateContentLoader(baseLoader)

    const windowManagerOptions: WindowManagerOptions = {
      windowOptions: this.options.windowOptions,
      contentLoader,
      enableDevTools: this.options.enableDevTools,
      onWindowClosed: () => {
        // window closed callback if needed in future
      },
    }

    // Get singleton instance and initialize it with options
    this.windowManager = WindowManager.getInstance(windowManagerOptions)
  }

  /**
   * Initialize the Electron application
   */
  async initialize(): Promise<void> {
    try {
      // Configure logging as early as possible
      configureLogging()
      logSystemInfo()

      // Handle single instance application
      if (this.options.enableSingleInstance) {
        this.handleSingleInstance()
      }

      // Initialize managers that handle renderer lifecycle & inbound events
      RendererLifecycleManager.instance.initialize()
      FileOpenManager.instance.initialize()
      DeeplinkManager.instance.initialize()

      initializeServices()

      // Wait for app to be ready
      await app.whenReady()

      // Initialize session CORS handling in both dev and production
      SessionManager.instance.initialize({
        isDevelopment: this.isDevelopment,
        devServerHost: this.options.devServerHost,
        devServerPort: this.options.devServerPort,
      })

      // Install React DevTools in development (best-effort; requires electron-devtools-installer)
      if (this.isDevelopment && this.options.enableDevTools) {
        try {
          // Dynamic import so build does not fail if dependency is missing in production
          const { default: installExtension, REACT_DEVELOPER_TOOLS } =
            await import('electron-devtools-installer')
          await installExtension(REACT_DEVELOPER_TOOLS)
          console.info('React DevTools installed')
        } catch (e) {
          // Non-fatal if not installed or fails
          console.warn('Failed to install React DevTools:', e)
        }
      }

      // Set application and dock icons
      IconManager.instance.setAppIcons()
      this.windowIconPath = IconManager.instance.getWindowIconPath()

      // Ensure default protocol client (magnet) registered in packaged builds
      DeeplinkManager.instance.registerProtocolClient()

      // SessionManager initialized above

      // IPC services are automatically initialized through the import

      // renderer lifecycle handled by RendererLifecycleManager

      // Initialize app menu
      AppMenuManager.instance.initialize()
      // Initialize system tray
      // TrayManager.instance.initialize()

      // Create main window via WindowManager with icon
      await this.windowManager.createMainWindow(this.windowIconPath)

      // Setup platform-specific window behaviors
      this.windowManager.handleAppActivation()
      this.windowManager.handleWindowClose()

      // Process initial argv
      FileOpenManager.instance.processInitialArgv(process.argv)
      DeeplinkManager.instance.processInitialArgv(process.argv)

      // Flush queued opens (e.g., macOS open-file before ready)
      // Pending buffers are flushed by the managers upon ready

      // Cleanup stale update resources at startup (best-effort)
      try {
        await UpdateService.shared.cleanup(2)
      } catch (e) {
        console.warn('Startup cleanup encountered issues:', e)
      }

      // Prioritized update flow: renderer hot-update first, then app updater
      await services.app.checkForUpdate()
    } catch (error) {
      console.error('Failed to initialize Electron application:', error)
      await this.showErrorDialog('Initialization Error', String(error))
      app.quit()
    }
  }

  /**
   * Handle single instance application
   */
  private handleSingleInstance(): void {
    SingleInstanceManager.instance.initialize()
  }

  /**
   * Show error dialog to user
   */
  private async showErrorDialog(title: string, content: string): Promise<void> {
    dialog.showErrorBox(title, content)
  }
}

// Export singleton instance
export const bootstrap = new ElectronBootstrap()
