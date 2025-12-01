import type {
  AddTorrentOptions,
  QBittorrentConfig,
} from '@torrent-vibe/qb-client'
import { QBittorrentClient } from '@torrent-vibe/qb-client'
import type { IpcContext } from 'electron-ipc-decorator'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

import { getLogger } from '../config/log-config'

type AnyArgs = any[]

const ExpiryTime = 800

const enableRequestLogging = false
/**
 * IPC service to handle all qBittorrent client interactions in the main process.
 * Renderer processes must call into this service via IPC instead of making HTTP requests.
 */
export class QBittorrentIPCService extends IpcService {
  static override readonly groupName = 'qb'

  private shared: QBittorrentClient | null = null
  private logger = getLogger('QBittorrentIPC')

  private sid: string | null = null

  // Dedupe + 1s cache for polling endpoints
  private readonly cacheableMethods = new Set<string>([
    'requestMainData',
    'requestTransferInfo',
  ])
  private readonly cache = new Map<string, { expiry: number; value: any }>()
  private readonly inFlight = new Map<string, Promise<any>>()

  private loggerIf(...args: any[]) {
    if (enableRequestLogging) {
      this.logger.debug(...args)
    }
  }

  private extendConfig(config: QBittorrentConfig): QBittorrentConfig {
    return {
      ...config,
      fetch: async (input, init) => {
        const start = Date.now()
        const requestId = Math.random().toString(36).slice(2, 8)

        const originalInit: any = init ?? {}
        const headers = this.headersToObject(originalInit.headers)
        if (this.sid) {
          headers['Cookie'] = `SID=${this.sid}`
        }

        const method = (
          originalInit.method ||
          (input && typeof input === 'object' && 'method' in (input as any)
            ? (input as any).method
            : 'GET') ||
          'GET'
        )
          .toString()
          .toUpperCase()

        const urlStr = this.normalizeUrlString(input)
        const maskedUrl = this.maskUrl(urlStr)
        const bodyDesc = this.describeBody(originalInit.body)

        this.loggerIf(`[${requestId}] -> ${method} ${maskedUrl}`, {
          headers: this.maskValue(headers),
          body: bodyDesc,
        })

        const finalInit = { ...originalInit, headers }

        try {
          const res = await fetch(input as any, finalInit)

          const cookies: string[] =
            (res as any).headers.getSetCookie?.() ??
            (res.headers.get('set-cookie')
              ? [res.headers.get('set-cookie') as string]
              : [])
          const sid = this.extractSid(cookies)
          if (sid && sid !== this.sid) {
            this.logger.debug(`[${requestId}] session SID updated`)
            this.sid = sid
          }

          const duration = Date.now() - start
          const contentLength = res.headers.get('content-length')
          const logLine = `[${requestId}] <- ${method} ${maskedUrl} ${res.status} ${res.statusText} ${
            contentLength ? `len=${contentLength} ` : ''
          }${duration}ms payload=${bodyDesc},${originalInit.body}`

          if (res.status >= 400) {
            this.logger.warn(logLine)
          } else {
            this.loggerIf(logLine)
          }

          return res
        } catch (err) {
          const duration = Date.now() - start
          this.logger.error(
            `[${requestId}] !! ${method} ${maskedUrl} failed in ${duration}ms`,
            { error: String(err) },
          )
          throw err
        }
      },
    }
  }

  @IpcMethod()
  setSharedConfig(_ctx: IpcContext, config: QBittorrentConfig): void {
    const safe = this.redactConfig(config)
    this.logger.info('setSharedConfig', safe)
    this.shared = QBittorrentClient.create(this.extendConfig(config))

    this.sid = null
  }

  @IpcMethod()
  async call(
    _ctx: IpcContext,
    method: string,
    args: AnyArgs = [],
  ): Promise<any> {
    if (!this.shared) throw new Error('QB client not configured')
    const fn = (this.shared as any)[method]
    if (typeof fn !== 'function') throw new Error(`Unknown method: ${method}`)

    const isCacheable = this.cacheableMethods.has(method)
    const key = isCacheable ? this.buildCacheKey('shared', method, args) : null

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
      const deserialized = await this.deserializeArgs(method, args)
      const result = await fn.apply(this.shared, deserialized)
      if (key) {
        this.cache.set(key, { expiry: Date.now() + ExpiryTime, value: result })
      }

      return result
    })()

    if (key) this.inFlight.set(key, exec)
    try {
      const res = await exec
      return res
    } finally {
      if (key) this.inFlight.delete(key)
    }
  }

  @IpcMethod()
  async callWithConfig(
    _ctx: IpcContext,
    config: QBittorrentConfig,
    method: string,
    args: AnyArgs = [],
  ): Promise<any> {
    const client = QBittorrentClient.create(this.extendConfig(config))
    const fn = (client as any)[method]
    if (typeof fn !== 'function') throw new Error(`Unknown method: ${method}`)

    const deserialized = await this.deserializeArgs(method, args)
    const result = await fn.apply(client, deserialized)

    return result
  }

  /**
   * Convert structured-clone safe payloads back to runtime types for Node.
   */
  private async deserializeArgs(
    method: string,
    args: AnyArgs,
  ): Promise<AnyArgs> {
    // Special handling for binary payloads passed for torrent uploads
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
            // Use global Blob from Node/undici
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

  private maskValue(v: any, depth = 0): any {
    if (depth > 2) return '[depth]'
    if (v == null) return v
    if (
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean'
    )
      return v
    if (Array.isArray(v))
      return v.slice(0, 50).map((x) => this.maskValue(x, depth + 1))
    if (typeof v === 'object') {
      const out: any = {}
      for (const [k, val] of Object.entries(v)) {
        if (/password|cookie|authorization|auth/i.test(k)) {
          out[k] = val ? '********' : ''
        } else if (k === 'torrents') {
          out[k] = '[omitted]'
        } else {
          out[k] = this.maskValue(val, depth + 1)
        }
      }
      return out
    }
    return String(v)
  }

  private extractSid(setCookies: string[]): string | null {
    for (const line of setCookies || []) {
      const m = /\bSID=([^;]+)/.exec(line)
      if (m) return m[1]
    }
    return null
  }

  private buildCacheKey(scope: string, method: string, args: AnyArgs): string {
    let argsKey = ''
    try {
      argsKey = JSON.stringify(args)
    } catch {
      argsKey = '[unserializable]'
    }
    return `${scope}::${method}::${argsKey}`
  }

  private normalizeUrlString(input: any): string {
    try {
      if (typeof input === 'string') return input
      if (input && typeof input === 'object' && 'url' in input) {
        return String((input as any).url)
      }
    } catch (err) {
      this.logger.debug('normalizeUrlString failed', { error: String(err) })
    }
    return '[unknown-url]'
  }

  private maskUrl(urlStr: string): string {
    try {
      const u = new URL(urlStr)
      const sensitive = /password|token|sid|auth|cookie|key|username/i
      u.searchParams.forEach((_, k) => {
        if (sensitive.test(k)) {
          u.searchParams.set(k, '********')
        }
      })
      return u.toString()
    } catch {
      return urlStr
    }
  }

  private headersToObject(headersLike: any): Record<string, string> {
    const out: Record<string, string> = {}
    if (!headersLike) return out
    try {
      if (
        typeof headersLike.forEach === 'function' &&
        typeof headersLike.append === 'function'
      ) {
        headersLike.forEach((v: string, k: string) => {
          out[k] = v
        })
        return out
      }
      if (Array.isArray(headersLike)) {
        for (const pair of headersLike as Array<[string, string]>) {
          const [k, v] = pair
          out[String(k)] = String(v)
        }
        return out
      }
      if (typeof headersLike === 'object') {
        for (const [k, v] of Object.entries(headersLike)) {
          out[String(k)] = String(v as any)
        }
      }
    } catch (err) {
      this.logger.debug('headersToObject failed', { error: String(err) })
    }
    return out
  }

  private describeBody(body: any): string {
    if (body == null) return 'none'
    if (typeof body === 'string') return `string(${body.length})`
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body))
      return `buffer(${body.length})`
    if (body instanceof Uint8Array) return `uint8(${body.byteLength})`
    if (typeof (body as any).size === 'number')
      return `binary(${(body as any).size})`

    if (body instanceof FormData) {
      return JSON.stringify(Object.fromEntries(body.entries()))
    }
    const name =
      (body && (body as any).constructor && (body as any).constructor.name) ||
      typeof body
    return name
  }
}
