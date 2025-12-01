import { QBittorrentClient } from '~/shared/api/qbittorrent-client'

import { loadServerPassword } from '../utils/server-config'
import { useMultiServerStore } from './multi-server-store'
import { serverHealthSetters } from './server-health-store'

type Timer = ReturnType<typeof setTimeout>

class ServerHealthMonitor {
  private static _instance: ServerHealthMonitor | null = null
  static get instance(): ServerHealthMonitor {
    if (!this._instance) this._instance = new ServerHealthMonitor()
    return this._instance
  }

  private timers = new Map<string, Timer>()
  private intervalMs = 30000
  private timeoutMs = 8000
  private failures = new Map<string, number>()

  start() {
    if (!ELECTRON) return
    // initialize for current servers
    const { order, servers } = useMultiServerStore.getState()
    order.forEach((id) => this.ensureTimer(id, servers[id]))

    // subscribe to changes
    useMultiServerStore.subscribe(
      (s) => ({ order: s.order, servers: s.servers }),
      ({ order, servers }) => {
        // add timers for new servers
        order.forEach((id) => this.ensureTimer(id, servers[id]))
        // remove timers for deleted servers
        for (const id of Array.from(this.timers.keys())) {
          if (!order.includes(id)) this.clearTimer(id)
        }
      },
      { equalityFn: Object.is },
    )
  }

  stop() {
    for (const id of Array.from(this.timers.keys())) this.clearTimer(id)
  }

  private clearTimer(id: string) {
    const t = this.timers.get(id)
    if (t) clearInterval(t)
    this.timers.delete(id)
  }

  private ensureTimer(id: string, server: any) {
    if (!server || this.timers.has(id)) return
    const schedule = (delay: number) => {
      const t = setTimeout(async () => {
        // Always fetch latest server config before checking
        const latest = useMultiServerStore.getState().servers[id]
        await this.check(id, latest)
        const f = this.failures.get(id) ?? 0
        const next =
          f > 0 ? Math.min(120000, this.intervalMs * 2 ** f) : this.intervalMs
        schedule(next)
      }, delay)
      this.timers.set(id, t)
    }
    // immediate then schedule next
    this.check(id, server).catch(() => {})
    schedule(this.intervalMs)
  }

  private async check(id: string, server: any) {
    const start = performance.now()
    try {
      // version endpoint is lightweight
      // include saved password when available to support auth-required setups
      const password =
        (await loadServerPassword(id)) ?? server.config?.password ?? ''
      const client = QBittorrentClient.create({ ...server.config, password })
      const res = await Promise.race<Promise<string | undefined>>([
        (async () => {
          try {
            return await client.getAppVersion()
          } catch {
            return undefined as any
          }
        })(),
        new Promise<undefined | void>((resolve) =>
          setTimeout(() => resolve(), this.timeoutMs),
        ),
      ])

      const dur = performance.now() - start

      const ok = Boolean(res)
      serverHealthSetters.setHealth(id, {
        serverId: id,
        status: ok ? (dur > 3000 ? 'warning' : 'healthy') : 'unhealthy',
        responseTime: Math.round(dur),
        lastChecked: new Date().toISOString(),
        consecutiveFailures: ok ? 0 : (this.failures.get(id) ?? 0) + 1,
        version: res,
      })
      this.failures.set(id, ok ? 0 : (this.failures.get(id) ?? 0) + 1)
    } catch (e) {
      const dur = performance.now() - start
      const fails = (this.failures.get(id) ?? 0) + 1
      serverHealthSetters.setHealth(id, {
        serverId: id,
        status: 'unhealthy',
        responseTime: Math.round(dur),
        lastChecked: new Date().toISOString(),
        consecutiveFailures: fails,
        error: e instanceof Error ? e.message : 'unknown',
      })
      this.failures.set(id, fails)
    }
  }
}

export const serverHealthMonitor = ServerHealthMonitor.instance
