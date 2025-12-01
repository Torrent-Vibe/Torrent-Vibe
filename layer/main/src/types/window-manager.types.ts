import type { BrowserWindow } from 'electron'

export interface WindowContentLoader {
  isDevelopment: boolean
  devServerPort?: number
  devServerHost?: string
  getPreloadPath: () => string
  getProductionIndexPath: () => string
}

export interface WindowManagerOptions {
  // 窗口基础配置
  windowOptions?: Electron.BrowserWindowConstructorOptions

  // 内容加载配置
  contentLoader?: WindowContentLoader

  // 生命周期回调
  onWindowReady?: (window: BrowserWindow) => void
  onWindowClosed?: () => void

  // 开发工具配置
  enableDevTools?: boolean
}

export interface IWindowManager {
  // 窗口生命周期
  createMainWindow: () => Promise<BrowserWindow>
  destroyMainWindow: () => void

  // 窗口状态管理
  getMainWindow: () => BrowserWindow | null
  isMainWindowCreated: () => boolean

  // 窗口操作
  showMainWindow: () => void
  hideMainWindow: () => void
  focusMainWindow: () => void
  minimizeMainWindow: () => void
  maximizeMainWindow: () => void
  toggleMaximizeMainWindow: () => void
  closeMainWindow: () => void

  // 平台特定行为
  handleAppActivation: () => void
  handleWindowClose: () => void
}
