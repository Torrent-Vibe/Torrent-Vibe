// Type definitions for the Electron preload API

export interface ElectronAPI {
  // Environment information
  isElectron: boolean
  isDevelopment: boolean
  platform: NodeJS.Platform
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    platform: NodeJS.Platform
  }
}
