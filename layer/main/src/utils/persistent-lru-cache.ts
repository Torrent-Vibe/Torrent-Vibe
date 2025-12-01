import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

import { getAppCacheDir } from '~/config/paths'

type PersistedRecord<V> = {
  key: string
  value: V
}

type PersistedCacheFile<V> = {
  version: 1
  namespace: string
  updatedAt: string
  limit: number
  ttlMs: number | null
  items: PersistedRecord<V>[]
}

export interface PersistentLRUCacheOptions<V> {
  /** File name to write (e.g., 'torrent-ai-cache.json') */
  fileName: string
  /** Logical namespace to validate file ownership */
  namespace: string
  /** Max number of entries to retain */
  limit: number
  /** TTL in milliseconds; if null/undefined, entries never expire */
  ttlMs?: number | null
  /** Return creation timestamp (ms) for a value to evaluate TTL */
  createdAtSelector?: (value: V) => number
}

/**
 * A disk-backed, debounce-persisted LRU-ish cache built on Map.
 * - Atomic-ish writes via tmp file + rename
 * - Graceful load with schema and namespace validation
 * - Optional TTL (evict stale on read, and during load)
 * - Eviction on overflow (oldest insertion order first)
 * - Touch-on-get only updates in-memory order to minimize IO
 */
export class PersistentLRUCache<V> {
  private readonly limit: number
  private readonly ttlMs: number | null
  private readonly createdAtSelector: (value: V) => number
  private readonly namespace: string
  private readonly filePath: string
  private writeTimer: NodeJS.Timeout | null = null

  private map = new Map<string, V>()

  constructor(options: PersistentLRUCacheOptions<V>) {
    const directory = getAppCacheDir()
    this.filePath = join(directory, options.fileName)
    this.namespace = options.namespace
    this.limit = Math.max(1, Math.floor(options.limit))
    this.ttlMs =
      options.ttlMs == null ? null : Math.max(0, Math.floor(options.ttlMs))
    this.createdAtSelector = options.createdAtSelector || ((_: V) => Date.now())
    this.ensureDirectory(dirname(this.filePath))
    this.load()
  }

  get size(): number {
    return this.map.size
  }

  keys(): IterableIterator<string> {
    return this.map.keys()
  }

  get(key: string): V | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined

    // TTL check
    if (this.isExpired(value)) {
      this.map.delete(key)
      this.scheduleWrite()
      return undefined
    }

    // Touch in-memory order (do not persist immediately to avoid IO churn)
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: string, value: V): this {
    this.map.set(key, value)
    this.evictIfNeeded()
    this.scheduleWrite()
    return this
  }

  delete(key: string): boolean {
    const existed = this.map.delete(key)
    if (existed) this.scheduleWrite()
    return existed
  }

  clear(): void {
    this.map.clear()
    try {
      rmSync(this.filePath, { force: true })
    } catch {
      // ignore
    }
  }

  private isExpired(value: V): boolean {
    if (this.ttlMs == null) return false
    const createdAt = this.createdAtSelector(value)
    if (!Number.isFinite(createdAt)) return false
    return createdAt + this.ttlMs < Date.now()
  }

  private evictIfNeeded() {
    while (this.map.size > this.limit) {
      const oldestKey = this.map.keys().next().value as string | undefined
      if (!oldestKey) break
      this.map.delete(oldestKey)
    }
  }

  private ensureDirectory(directory: string) {
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true })
    }
  }

  private load() {
    if (!existsSync(this.filePath)) return
    try {
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as PersistedCacheFile<V>
      if (
        !parsed ||
        parsed.version !== 1 ||
        parsed.namespace !== this.namespace
      ) {
        return
      }

      const next = new Map<string, V>()
      for (const record of parsed.items || []) {
        if (!record || typeof record.key !== 'string') continue
        const value = record.value as V
        if (this.isExpired(value)) continue
        next.set(record.key, value)
        if (next.size >= this.limit) break
      }
      this.map = next
    } catch {
      // ignore corrupted cache
      this.map.clear()
    }
  }

  private scheduleWrite() {
    if (this.writeTimer) clearTimeout(this.writeTimer)
    this.writeTimer = setTimeout(() => this.writeNow(), 150)
  }

  private writeNow() {
    const payload: PersistedCacheFile<V> = {
      version: 1,
      namespace: this.namespace,
      updatedAt: new Date().toISOString(),
      limit: this.limit,
      ttlMs: this.ttlMs ?? null,
      items: Array.from(this.map.entries()).map(([key, value]) => ({
        key,
        value,
      })),
    }

    try {
      const dir = dirname(this.filePath)
      this.ensureDirectory(dir)
      const tmp = `${this.filePath}.tmp`

      // write tmp, fsync, rename for durability
      const data = JSON.stringify(payload)
      writeFileSync(tmp, data, 'utf8')
      try {
        const fd = openSync(tmp, 'r+')
        try {
          fsyncSync(fd)
        } finally {
          closeSync(fd)
        }
      } catch {
        // ignore fsync issues
      }
      renameSync(tmp, this.filePath)
    } catch {
      // ignore write errors
    }
  }
}
