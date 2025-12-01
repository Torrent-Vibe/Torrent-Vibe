import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import type { AiProviderId } from '@torrent-vibe/shared'
import { AI_PROVIDER_IDS } from '@torrent-vibe/shared'
import { app } from 'electron'

interface AppSettingsData {
  search?: {
    chromeExecutablePath?: string | null
  }
  ai?: {
    preferredProviders?: AiProviderId[]
  }
}

const DIRECTORY_NAME = 'config'
const FILE_NAME = 'app-settings.json'

const ensureDirectory = (path: string) => {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
  }
}

const sanitizePath = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

export class AppSettingsStore {
  private static instance: AppSettingsStore | null = null

  static getInstance(): AppSettingsStore {
    if (!this.instance) {
      this.instance = new AppSettingsStore()
    }
    return this.instance
  }

  private readonly filePath: string
  private cache: AppSettingsData = {}

  private constructor() {
    const basePath = app.getPath('userData')
    const directory = join(basePath, DIRECTORY_NAME)
    ensureDirectory(directory)
    this.filePath = join(directory, FILE_NAME)
    this.load()
  }

  private load() {
    if (!existsSync(this.filePath)) {
      this.cache = {}
      return
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as AppSettingsData
      this.cache = parsed && typeof parsed === 'object' ? parsed : {}
    } catch (error) {
      console.warn('[app-settings] failed to load store, resetting', error)
      this.cache = {}
    }
  }

  private save() {
    try {
      const directory = dirname(this.filePath)
      ensureDirectory(directory)
      writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf8')
    } catch (error) {
      console.error('[app-settings] failed to persist store', error)
    }
  }

  getChromeExecutablePath(): string | null {
    return sanitizePath(this.cache.search?.chromeExecutablePath) ?? null
  }

  setChromeExecutablePath(path: string | null) {
    const normalized = sanitizePath(path)
    this.cache.search = {
      ...this.cache.search,
      chromeExecutablePath: normalized,
    }
    this.save()
  }

  getPreferredAiProviders(): AiProviderId[] {
    const stored = this.cache.ai?.preferredProviders ?? []
    const valid = stored.filter((id): id is AiProviderId =>
      AI_PROVIDER_IDS.includes(id),
    )

    if (valid.length > 0) {
      return Array.from(new Set(valid))
    }

    return [...AI_PROVIDER_IDS]
  }

  setPreferredAiProviders(order: AiProviderId[]): AiProviderId[] {
    const normalized = order.filter((id): id is AiProviderId =>
      AI_PROVIDER_IDS.includes(id),
    )

    const deduped = normalized.length > 0 ? Array.from(new Set(normalized)) : []

    const finalOrder = deduped.length > 0 ? deduped : [...AI_PROVIDER_IDS]

    this.cache.ai = {
      ...this.cache.ai,
      preferredProviders: finalOrder,
    }

    this.save()

    return finalOrder
  }
}
