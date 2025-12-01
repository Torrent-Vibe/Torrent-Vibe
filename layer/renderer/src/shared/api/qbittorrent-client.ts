/* eslint-disable unicorn/no-static-only-class */
// In web builds, use the HTTP client directly.
// In Electron builds, calls must go through IPC to the main process.

import type { QBittorrent } from '@innei/qbittorrent-browser'
import type {
  AddTorrentOptions,
  QBittorrentConfig,
} from '@torrent-vibe/qb-client'

import { ipcServices } from '~/lib/ipc-client'

const useElectronAdapter = ELECTRON
const forceUseRendererRequest =
  import.meta.env.VITE_APP_FORCE_USE_RENDERER_REQUEST === '1'

export class QBittorrentClient {
  static shared: (typeof import('@torrent-vibe/qb-client').QBittorrentClient)['shared']
  static configure: (config: QBittorrentConfig) => void
  static create: (
    config: QBittorrentConfig,
  ) => typeof import('@torrent-vibe/qb-client').QBittorrentClient & QBittorrent
}

if (!useElectronAdapter || forceUseRendererRequest) {
  // Re-export the browser client in web builds

  // const mod = require('@torrent-vibe/qb-client')
  const mod = await import('@torrent-vibe/qb-client')

  // @ts-ignore - reassign exported class
  QBittorrentClient = mod.QBittorrentClient
} else {
  type AnyFn = (...args: any[]) => any

  // Adapter instance that proxies any method call to main via IPC.
  class AdapterImpl {
    // Index signature for TS to accept arbitrary method names.
    [key: string]: any

    private ownConfig?: QBittorrentConfig

    constructor(config?: QBittorrentConfig) {
      this.ownConfig = config
      // Return a proxy to trap arbitrary method calls
      return new Proxy(this, {
        get: (target, prop, receiver) => {
          if (prop in target) return Reflect.get(target, prop, receiver)
          if (typeof prop !== 'string') return
          // Return a function that forwards to IPC
          const fn: AnyFn = async (...args: any[]) => {
            return await (target as AdapterImpl).invoke(prop, args)
          }
          return fn
        },
      })
    }

    private static ready: Promise<void> = Promise.resolve()

    static shared: AdapterImpl = new AdapterImpl()

    static configure(config: QBittorrentConfig): void {
      // Set shared config in main and reset shared instance
      AdapterImpl.ready = (async () => {
        await ipcServices?.qb.setSharedConfig(config)
      })()
      AdapterImpl.shared = new AdapterImpl()
    }

    static create(config: QBittorrentConfig): AdapterImpl {
      return new AdapterImpl(config)
    }

    static clone(): AdapterImpl {
      return new AdapterImpl()
    }

    private async invoke(method: string, args: any[]): Promise<any> {
      // Special-case serialization for add torrent with blobs
      const serArgs = await this.serializeArgs(method, args)
      if (this.ownConfig) {
        return await ipcServices?.qb.callWithConfig(
          this.ownConfig,
          method,
          serArgs,
        )
      }
      await AdapterImpl.ready
      return await ipcServices?.qb.call(method, serArgs)
    }

    private async serializeArgs(method: string, args: any[]): Promise<any[]> {
      if (method === 'requestAddTorrent' && args[0]) {
        const opts = args[0] as AddTorrentOptions & {
          torrents?: (File | Blob)[]
        }
        if (opts.torrents && Array.isArray(opts.torrents)) {
          const converted = await Promise.all(
            opts.torrents.map(async (item) => {
              if (item && typeof item.arrayBuffer === 'function') {
                const ab = await (item as Blob).arrayBuffer()
                return {
                  __binary: true,
                  data: new Uint8Array(ab),
                  type: (item as Blob).type || 'application/octet-stream',
                }
              }
              return item
            }),
          )
          ;(opts as any).torrents = converted
          args[0] = opts
        }
      }
      return args
    }
  }

  // @ts-ignore - reassign exported class symbol to adapter
  QBittorrentClient = AdapterImpl
}
