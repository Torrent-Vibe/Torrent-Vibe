import type { QBittorrentConfig } from '@torrent-vibe/qb-client'
import { QBittorrentClient } from '@torrent-vibe/qb-client'

import { getLogger } from '../config/log-config'

export type QbSession = {
  key: string
  config: QBittorrentConfig
  client: QBittorrentClient
  sid: string | null
}

type AnyArgs = any[]

const enableRequestLogging = false

export function connectionKey(config: QBittorrentConfig): string {
  const username = config.username ?? ''
  if (config.baseUrl && !config.baseUrl.startsWith('/')) {
    return `${config.baseUrl.replace(/\/$/, '')}|${username}`
  }
  const protocol = config.useHttps ? 'https' : 'http'
  const path = config.baseUrl?.startsWith('/')
    ? config.baseUrl.replace(/\/$/, '')
    : ''
  return `${protocol}://${config.host}:${config.port}${path}|${username}`
}

export function sameCredentials(
  a: QBittorrentConfig,
  b: QBittorrentConfig,
): boolean {
  return a.username === b.username && a.password === b.password
}

export function isForbiddenError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  return /http 403\b|\bforbidden\b/i.test(error.message)
}

export class QbSessionPool {
  private readonly sessions = new Map<string, QbSession>()
  private readonly scopeKeys = new Map<string, string>()
  private activeKey: string | null = null
  private readonly logger = getLogger('QBittorrentIPC')

  setSharedConfig(config: QBittorrentConfig, scopeId?: string): QbSession {
    const key = connectionKey(config)
    const existing = this.sessions.get(key)
    const sid =
      existing && sameCredentials(existing.config, config) ? existing.sid : null
    const session = this.createSession(config, key, sid)
    this.sessions.set(key, session)
    if (scopeId) {
      this.scopeKeys.set(scopeId, key)
    }
    this.activeKey = key
    return session
  }

  getActive(): QbSession | null {
    if (!this.activeKey) {
      return null
    }
    return this.sessions.get(this.activeKey) ?? null
  }

  getByKey(key: string): QbSession | null {
    return this.sessions.get(key) ?? null
  }

  getByScopeId(scopeId: string): QbSession | null {
    const key = this.scopeKeys.get(scopeId)
    return key ? this.getByKey(key) : null
  }

  sessionFor(config: QBittorrentConfig): QbSession {
    const key = connectionKey(config)
    const existing = this.sessions.get(key)
    if (existing && sameCredentials(existing.config, config)) {
      return existing
    }
    const session = this.createSession(config, key, null)
    this.sessions.set(key, session)
    return session
  }

  async invoke(
    session: QbSession,
    method: string,
    args: AnyArgs,
  ): Promise<any> {
    const fn = (session.client as any)[method]
    if (typeof fn !== 'function') {
      throw new TypeError(`Unknown method: ${method}`)
    }

    try {
      return await fn.apply(session.client, args)
    } catch (error) {
      if (method === 'login') {
        session.sid = null
        throw error
      }
      if (!isForbiddenError(error)) {
        throw error
      }
      await session.client.login()
      return await fn.apply(session.client, args)
    }
  }

  private createSession(
    config: QBittorrentConfig,
    key: string,
    sid: string | null,
  ): QbSession {
    const session: QbSession = {
      key,
      config,
      client: null as unknown as QBittorrentClient,
      sid,
    }
    session.client = QBittorrentClient.create(
      this.extendConfig(config, session),
    )
    return session
  }

  private extendConfig(
    config: QBittorrentConfig,
    session: QbSession,
  ): QBittorrentConfig {
    return {
      ...config,
      fetch: async (input, init) => {
        const start = Date.now()
        const requestId = Math.random().toString(36).slice(2, 8)
        const originalInit: any = init ?? {}
        const headers = this.headersToObject(originalInit.headers)
        if (session.sid) {
          headers.Cookie = `SID=${session.sid}`
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
          if (sid && sid !== session.sid) {
            this.logger.debug(`[${requestId}] session SID updated`)
            session.sid = sid
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

  private loggerIf(...args: any[]) {
    if (enableRequestLogging) {
      this.logger.debug(...args)
    }
  }

  private extractSid(setCookies: string[]): string | null {
    for (const line of setCookies || []) {
      const m = /\bSID=([^;]+)/.exec(line)
      if (m) {
        return m[1]
      }
    }
    return null
  }

  private normalizeUrlString(input: any): string {
    try {
      if (typeof input === 'string') {
        return input
      }
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
    if (!headersLike) {
      return out
    }
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

  private maskValue(v: any, depth = 0): any {
    if (depth > 2) {
      return '[depth]'
    }
    if (v == null) {
      return v
    }
    if (
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean'
    ) {
      return v
    }
    if (Array.isArray(v)) {
      return v.slice(0, 50).map((x) => this.maskValue(x, depth + 1))
    }
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

  private describeBody(body: any): string {
    if (body == null) {
      return 'none'
    }
    if (typeof body === 'string') {
      return `string(${body.length})`
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) {
      return `buffer(${body.length})`
    }
    if (body instanceof Uint8Array) {
      return `uint8(${body.byteLength})`
    }
    if (typeof (body as any).size === 'number') {
      return `binary(${(body as any).size})`
    }

    if (body instanceof FormData) {
      return JSON.stringify(Object.fromEntries(body.entries()))
    }
    const name =
      (body && (body as any).constructor && (body as any).constructor.name) ||
      typeof body
    return name
  }
}

export const sharedQbSessionPool = new QbSessionPool()
