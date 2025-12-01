import type { AppErrorCode } from '@torrent-vibe/shared'

export interface BridgeEventMap {
  // Update events
  'update:checking': { startedAt: string }
  'update:ready': { version: string; prerelease: boolean }
  'update:progress': { percent: number; transferred: number; total: number }
  'update:error': { message: string; code?: AppErrorCode; downloadUrl?: string }
  'update:downloaded': { version: string }
  'update:uptodate': {
    reason: 'no-release' | 'up-to-date' | 'older-than-app' | 'incompatible'
    installed?: string | null
    latest?: string | null
  }

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
