// Type definitions for the Electron preload API

export interface ElectronAPI {
  isDevelopment: boolean
  // Environment information
  isElectron: boolean
  platform: NodeJS.Platform
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    platform: NodeJS.Platform
  }
}
