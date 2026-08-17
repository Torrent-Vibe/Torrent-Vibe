import type { BrowserWindow } from 'electron'

export interface WindowContentLoader {
  devServerHost?: string
  devServerPort?: number
  getPreloadPath: () => string
  getProductionIndexPath: () => string
  isDevelopment: boolean
}

export interface WindowManagerOptions {
  // 内容加载配置
  contentLoader?: WindowContentLoader

  // 开发工具配置
  enableDevTools?: boolean

  onWindowClosed?: () => void
  // 生命周期回调
  onWindowReady?: (window: BrowserWindow) => void

  // 窗口基础配置
  windowOptions?: Electron.BrowserWindowConstructorOptions
}

export interface IWindowManager {
  closeMainWindow: () => void
  // 窗口生命周期
  createMainWindow: () => Promise<BrowserWindow>

  destroyMainWindow: () => void
  focusMainWindow: () => void

  // 窗口状态管理
  getMainWindow: () => BrowserWindow | null
  // 平台特定行为
  handleAppActivation: () => void
  handleWindowClose: () => void
  hideMainWindow: () => void
  isMainWindowCreated: () => boolean
  maximizeMainWindow: () => void
  minimizeMainWindow: () => void

  // 窗口操作
  showMainWindow: () => void
  toggleMaximizeMainWindow: () => void
}
