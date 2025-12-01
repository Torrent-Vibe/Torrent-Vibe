declare global {
  interface Window {
    platform: NodeJS.Platform
  }
}

export const isMacOS = window.platform === 'darwin'
export const isWindows = window.platform === 'win32'
export const isLinux = window.platform === 'linux'
