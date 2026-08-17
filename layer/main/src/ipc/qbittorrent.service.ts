import type {
  AddTorrentOptions,
  QBittorrentConfig,
} from '@torrent-vibe/qb-client'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

import { getLogger } from '../config/log-config'
import { QbSessionPool } from './qb-session-pool'

type AnyArgs = any[]

const ExpiryTime = 800

export class QBittorrentIPCService extends IpcService {
  static override readonly groupName = 'qb'

  private readonly pool = new QbSessionPool()
  private readonly logger = getLogger('QBittorrentIPC')

  private readonly cacheableMethods = new Set<string>([
    'requestMainData',
    'requestTransferInfo',
  ])

  private readonly cache = new Map<string, { expiry: number; value: any }>()
  private readonly inFlight = new Map<string, Promise<any>>()

  @IpcMethod()
  setSharedConfig(config: QBittorrentConfig): void {
    this.logger.info('setSharedConfig', this.redactConfig(config))
    this.pool.setSharedConfig(config)
  }

  @IpcMethod()
  async call(method: string, args: AnyArgs = []): Promise<any> {
    const session = this.pool.getActive()
    if (!session) {
      throw new Error('QB client not configured')
    }

    const deserialized = await this.deserializeArgs(method, args)
    const isCacheable = this.cacheableMethods.has(method)
    const key = isCacheable
      ? this.buildCacheKey(session.key, method, deserialized)
      : null

    if (key) {
      const hit = this.cache.get(key)
      if (hit && hit.expiry > Date.now()) {
        return hit.value
      }
      const pending = this.inFlight.get(key)
      if (pending) {
        return pending
      }
    }

    const exec = (async () => {
      const result = await this.pool.invoke(session, method, deserialized)
      if (key) {
        this.cache.set(key, { expiry: Date.now() + ExpiryTime, value: result })
      }
      return result
    })()

    if (key) {
      this.inFlight.set(key, exec)
    }
    try {
      return await exec
    } finally {
      if (key) {
        this.inFlight.delete(key)
      }
    }
  }

  @IpcMethod()
  async callWithConfig(
    config: QBittorrentConfig,
    method: string,
    args: AnyArgs = [],
  ): Promise<any> {
    const session = this.pool.sessionFor(config)
    const deserialized = await this.deserializeArgs(method, args)
    return this.pool.invoke(session, method, deserialized)
  }

  private async deserializeArgs(
    method: string,
    args: AnyArgs,
  ): Promise<AnyArgs> {
    if (method === 'requestAddTorrent' && args[0]) {
      const options = args[0] as AddTorrentOptions & {
        torrents?: Array<
          | Blob
          | {
              __binary: true
              data: Uint8Array
              type?: string
              name?: string
            }
        >
      }
      if (options.torrents && Array.isArray(options.torrents)) {
        const toBlobs = options.torrents.map((item) => {
          if (item && typeof (item as any).__binary === 'boolean') {
            const { data, type } = item as any
            return new Blob([Buffer.from(data)], {
              type: type || 'application/octet-stream',
            })
          }
          return item as any
        })

        ;(options as any).torrents = toBlobs
        args[0] = options
      }
    }
    return args
  }

  private redactConfig(cfg: QBittorrentConfig) {
    return {
      ...cfg,
      password: cfg.password ? '********' : '',
    }
  }

  private buildCacheKey(scope: string, method: string, args: AnyArgs): string {
    let argsKey: string
    try {
      argsKey = JSON.stringify(args)
    } catch {
      argsKey = '[unserializable]'
    }
    return `${scope}::${method}::${argsKey}`
  }
}
