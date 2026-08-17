import type { AiTraceEvent } from '@torrent-vibe/shared'

import type { UpdaterUiStatus } from '~/updater/status'

export interface BridgeEventMap {
  // Deeplink events
  'deeplink:magnet': {
    links: string[]
  }
  // File open events (OS-level association)
  'file:open-torrents': {
    files: Array<{
      name: string
      data: Uint8Array
      mime?: string
    }>
  }

  // Settings events
  'settings:open': { tab: 'about' | 'appearance' }

  'torrent-ai:trace': AiTraceEvent

  'updater:status': UpdaterUiStatus
}

export type BridgeEventName = keyof BridgeEventMap
export type BridgeEventData<T extends BridgeEventName> = BridgeEventMap[T]
