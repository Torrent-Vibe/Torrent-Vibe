import type { UpdaterUiStatus } from '~/updater/status'

export interface BridgeEventMap {
  // Updater status push (Sparkle on macOS, electron-updater on win/linux)
  'updater:status': UpdaterUiStatus

  // File open events (OS-level association)
  'file:open-torrents': {
    files: Array<{
      name: string
      data: Uint8Array
      mime?: string
    }>
  }

  // Deeplink events
  'deeplink:magnet': {
    links: string[]
  }

  // Settings events
  'settings:open': { tab: 'about' | 'appearance' }
}

export type BridgeEventName = keyof BridgeEventMap
export type BridgeEventData<T extends BridgeEventName> = BridgeEventMap[T]
