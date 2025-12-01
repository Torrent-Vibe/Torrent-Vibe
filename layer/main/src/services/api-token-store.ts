import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { app, safeStorage } from 'electron'

export type ApiTokenEncryption = 'safeStorage' | 'plain'

export interface StoredApiToken {
  id: string
  value: string
  hint: string | null
  encryption: ApiTokenEncryption
  createdAt: string
  updatedAt: string
}

export interface ApiTokenSummary {
  id: string
  hint: string | null
  encryption: ApiTokenEncryption
  createdAt: string
  updatedAt: string
  hasValue: boolean
}

type ApiTokenStoreData = Record<string, StoredApiToken>

const DIRECTORY_NAME = 'secure'
const FILE_NAME = 'api-tokens.json'

export class ApiTokenStore {
  private static instance: ApiTokenStore | null = null
  static getInstance(): ApiTokenStore {
    if (!this.instance) {
      this.instance = new ApiTokenStore()
    }
    return this.instance
  }

  private readonly filePath: string
  private cache: ApiTokenStoreData = {}

  private constructor() {
    const basePath = app.getPath('userData')
    const directory = join(basePath, DIRECTORY_NAME)
    this.filePath = join(directory, FILE_NAME)
    this.ensureDirectory(directory)
    this.load()
  }

  private ensureDirectory(directory: string) {
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true })
    }
  }

  private load() {
    if (!existsSync(this.filePath)) {
      this.cache = {}
      return
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as ApiTokenStoreData
      if (parsed && typeof parsed === 'object') {
        this.cache = parsed
      } else {
        this.cache = {}
      }
    } catch (error) {
      console.warn('[api-tokens] failed to load token store', error)
      this.cache = {}
    }
  }

  private save() {
    try {
      const directory = dirname(this.filePath)
      this.ensureDirectory(directory)
      writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf8')
    } catch (error) {
      console.error('[api-tokens] failed to persist token store', error)
    }
  }

  listSummaries(): ApiTokenSummary[] {
    return Object.entries(this.cache).map(([id, record]) => ({
      id,
      hint: record.hint ?? null,
      encryption: record.encryption,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      hasValue: Boolean(record.value),
    }))
  }

  getTokenValue(id: string): string | null {
    const record = this.cache[id]
    if (!record || !record.value) {
      return null
    }

    try {
      if (record.encryption === 'safeStorage') {
        const buf = Buffer.from(record.value, 'base64')
        return safeStorage.decryptString(buf)
      }

      const plain = Buffer.from(record.value, 'base64').toString('utf8')
      return plain
    } catch (error) {
      console.error('[api-tokens] failed to decrypt token', {
        id,
        error,
      })
      return null
    }
  }

  setTokenValue(
    id: string,
    value: string,
    preferredEncryption: ApiTokenEncryption,
  ): ApiTokenSummary {
    const trimmed = value.trim()
    const now = new Date().toISOString()
    const previous = this.cache[id]

    let encryption: ApiTokenEncryption = 'plain'
    let storedValue: string

    try {
      if (
        preferredEncryption === 'safeStorage' &&
        safeStorage.isEncryptionAvailable()
      ) {
        const encrypted = safeStorage.encryptString(trimmed)
        storedValue = encrypted.toString('base64')
        encryption = 'safeStorage'
      } else {
        storedValue = Buffer.from(trimmed, 'utf8').toString('base64')
        encryption = 'plain'
      }
    } catch (error) {
      console.warn(
        '[api-tokens] safeStorage encrypt failed, falling back',
        error,
      )
      storedValue = Buffer.from(trimmed, 'utf8').toString('base64')
      encryption = 'plain'
    }

    const hint = encryption === 'safeStorage' ? this.buildHint(trimmed) : null

    this.cache[id] = {
      id,
      value: storedValue,
      hint,
      encryption,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    }

    this.save()

    return {
      id,
      hint,
      encryption,
      createdAt: this.cache[id].createdAt,
      updatedAt: now,
      hasValue: true,
    }
  }

  clearTokenValue(id: string): ApiTokenSummary {
    if (!this.cache[id]) {
      const now = new Date().toISOString()
      return {
        id,
        hint: null,
        encryption: 'plain',
        createdAt: now,
        updatedAt: now,
        hasValue: false,
      }
    }

    const existing = this.cache[id]
    delete this.cache[id]
    this.save()

    return {
      id,
      hint: null,
      encryption: existing.encryption,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      hasValue: false,
    }
  }

  private buildHint(value: string): string | null {
    if (!value) return null
    const sanitized = value.replaceAll(/\s+/g, '')
    if (sanitized.length <= 4) {
      return sanitized
    }
    return sanitized.slice(-4)
  }
}
