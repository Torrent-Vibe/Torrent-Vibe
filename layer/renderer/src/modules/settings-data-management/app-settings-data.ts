import type { AiProviderId } from '@torrent-vibe/shared'
import { AI_PROVIDER_IDS } from '@torrent-vibe/shared'
import { z } from 'zod'

import { AI_ENABLED_STORAGE_KEY } from '~/lib/ai-integration'
import { ipcServices } from '~/lib/ipc-client'
import { STORAGE_KEYS } from '~/lib/storage-keys'
import type { ApiTokenSlotId } from '~/modules/api-tokens/definitions'
import { API_TOKEN_SLOTS } from '~/modules/api-tokens/definitions'
import { multiServerStoreSetters } from '~/modules/multi-server/stores/multi-server-store'
import type {
  MultiServerConfig,
  ServerConnection,
} from '~/modules/multi-server/types/multi-server'
import {
  loadMultiServerConfig,
  loadServerPassword,
  saveMultiServerConfig,
  saveServerPassword,
} from '~/modules/multi-server/utils/server-config'
import { ONBOARDING_FORM_STORAGE_KEY } from '~/modules/onboarding/onboardingStorage'

const EXPORT_VERSION = 1 as const

const STATIC_MANAGED_STORAGE_KEYS = new Set<string>([
  STORAGE_KEYS.THEME,
  STORAGE_KEYS.PREFERRED_LANGUAGE,
  STORAGE_KEYS.ACCENT_COLOR,
  STORAGE_KEYS.COLOR_STYLE,
  STORAGE_KEYS.CONNECTION_CONFIG,
  STORAGE_KEYS.CONNECTION_PASSWORD,
  STORAGE_KEYS.POLLING_INTERVAL,
  STORAGE_KEYS.SHOW_FLOAT_ON_CLOSE,
  STORAGE_KEYS.PATH_MAPPINGS,
  STORAGE_KEYS.MULTI_SERVER_CONFIG,
  STORAGE_KEYS.DISCOVER_PROVIDERS,
  STORAGE_KEYS.DISCOVER_SEARCH_HISTORY,
  ...Object.values(STORAGE_KEYS.TORRENT_TABLE),
  AI_ENABLED_STORAGE_KEY,
  ONBOARDING_FORM_STORAGE_KEY,
])

const EXPORTABLE_LOCAL_STORAGE_KEYS = new Set<string>(
  [...STATIC_MANAGED_STORAGE_KEYS].filter(
    (key) => key !== STORAGE_KEYS.MULTI_SERVER_CONFIG,
  ),
)

const hasOwn = (object: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(object, key)

const desktopAppSettingsSchema = z.object({
  chromeExecutablePath: z.string().nullable().optional(),
  aiPreferredProviders: z.array(z.string()).optional(),
})

const apiTokenSlotExportSchema = z.object({
  id: z.string().min(1),
  value: z.string().min(1),
  encryption: z
    .union([z.literal('safeStorage'), z.literal('plain')])
    .optional(),
  hint: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
})

const apiTokensExportSchema = z.object({
  slots: z.array(apiTokenSlotExportSchema).default([]),
})

const serverConnectionWithPasswordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  config: z.object({
    host: z.string().min(1),
    port: z.number().int(),
    username: z.string().min(1),
    password: z.string(),
    useHttps: z.boolean(),
    baseUrl: z.string().optional(),
  }),
  isDefault: z.boolean(),
  lastConnected: z.string().optional(),
  status: z.union([
    z.literal('disconnected'),
    z.literal('connecting'),
    z.literal('connected'),
    z.literal('error'),
  ]),
  tags: z.array(z.string()).optional(),
  color: z.string().optional(),
})

const multiServerExportSchema = z.object({
  servers: z.array(serverConnectionWithPasswordSchema),
  activeServerId: z.string().nullable(),
})

type ExportedServerConnection = z.infer<
  typeof serverConnectionWithPasswordSchema
>

type DesktopAppSettingsExport = z.infer<typeof desktopAppSettingsSchema>

export const appSettingsExportSchema = z.object({
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.string(),
  localStorage: z.record(z.string(), z.string()).default({}),
  multiServer: multiServerExportSchema.optional(),
  desktopAppSettings: desktopAppSettingsSchema.optional(),
  apiTokens: apiTokensExportSchema.optional(),
})

export type AppSettingsExport = z.infer<typeof appSettingsExportSchema>

export interface AppSettingsImportResult {
  appliedLocalStorage: number
  importedServers: number
  appliedDesktopSettings: number
  appliedApiTokens: number
}

function collectManagedLocalStorageEntries(): Record<string, string> {
  if (typeof localStorage === 'undefined') {
    return {}
  }

  const entries: Record<string, string> = {}
  EXPORTABLE_LOCAL_STORAGE_KEYS.forEach((key) => {
    const value = localStorage.getItem(key)
    if (value == null) return
    entries[key] = value
  })

  return entries
}

function normalizeAiProviderOrder(order?: unknown): AiProviderId[] {
  if (!Array.isArray(order)) {
    return [...AI_PROVIDER_IDS]
  }

  const seen = new Set<AiProviderId>()
  const normalized: AiProviderId[] = []

  for (const value of order) {
    if (typeof value !== 'string') continue
    if (!AI_PROVIDER_IDS.includes(value as AiProviderId)) continue
    const id = value as AiProviderId
    if (seen.has(id)) continue
    seen.add(id)
    normalized.push(id)
  }

  for (const id of AI_PROVIDER_IDS) {
    if (!seen.has(id)) {
      normalized.push(id)
    }
  }

  return normalized
}

async function collectDesktopAppSettings(): Promise<
  DesktopAppSettingsExport | undefined
> {
  if (!ELECTRON) return undefined
  const service = ipcServices?.appSettings
  if (!service) return undefined

  const [searchSettings, aiSettings] = await Promise.all([
    service.getSearchSettings?.() ?? Promise.resolve(),
    service.getAiSettings?.() ?? Promise.resolve(),
  ])

  const payload: DesktopAppSettingsExport = {}
  let hasValue = false

  if (searchSettings && 'chromeExecutablePath' in searchSettings) {
    payload.chromeExecutablePath =
      typeof searchSettings.chromeExecutablePath === 'string'
        ? searchSettings.chromeExecutablePath
        : null
    hasValue = true
  }

  if (aiSettings && 'preferredProviders' in aiSettings) {
    payload.aiPreferredProviders = normalizeAiProviderOrder(
      aiSettings.preferredProviders,
    )
    hasValue = true
  }

  return hasValue ? payload : undefined
}

async function collectApiTokenExport(): Promise<
  AppSettingsExport['apiTokens']
> {
  if (!ELECTRON) return undefined
  const service = ipcServices?.apiTokens
  if (!service?.listSlots || !service.getValue) return undefined

  try {
    const summaries = await service.listSlots()
    if (!Array.isArray(summaries) || summaries.length === 0) {
      return undefined
    }

    const slots: Array<z.infer<typeof apiTokenSlotExportSchema>> = []
    for (const summary of summaries) {
      if (!summary?.hasValue) continue
      if (!summary.id) continue
      const value = await service.getValue(summary.id)
      if (typeof value !== 'string') continue
      const trimmed = value.trim()
      if (!trimmed) continue
      slots.push({
        id: summary.id,
        value: trimmed,
        encryption: summary.encryption,
        hint: summary.hint ?? null,
        updatedAt: summary.updatedAt,
      })
    }

    return slots.length > 0 ? { slots } : undefined
  } catch (error) {
    console.error('[settings-export] failed to collect api tokens', error)
    return undefined
  }
}

async function collectMultiServerExport(): Promise<
  AppSettingsExport['multiServer']
> {
  const config = loadMultiServerConfig()
  if (config.servers.length === 0) return undefined

  const serversWithPasswords = await Promise.all(
    config.servers.map(async (server) => {
      const rememberedPassword = await loadServerPassword(server.id)
      return {
        ...server,
        config: {
          ...server.config,
          password: rememberedPassword ?? server.config.password ?? '',
        },
      }
    }),
  )

  return {
    servers: serversWithPasswords,
    activeServerId: config.activeServerId,
  }
}

export async function exportAppSettings(): Promise<AppSettingsExport> {
  const [localStorageEntries, multiServer, desktopAppSettings, apiTokens] =
    await Promise.all([
      Promise.resolve(collectManagedLocalStorageEntries()),
      collectMultiServerExport(),
      collectDesktopAppSettings(),
      collectApiTokenExport(),
    ])

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    localStorage: localStorageEntries,
    multiServer,
    desktopAppSettings,
    apiTokens,
  }
}

export async function exportAppSettingsAsString(): Promise<string> {
  const exportData = await exportAppSettings()
  return JSON.stringify(exportData, null, 2)
}

function clearManagedLocalStorage() {
  if (typeof localStorage === 'undefined') return

  const existingConfig = loadMultiServerConfig()

  STATIC_MANAGED_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key)
  })

  existingConfig.servers.forEach((server) => {
    localStorage.removeItem(STORAGE_KEYS.serverPasswordKey(server.id))
  })
}

function applyLocalStorageEntries(entries: Record<string, string>): number {
  if (typeof localStorage === 'undefined') return 0

  clearManagedLocalStorage()

  let applied = 0
  for (const [key, value] of Object.entries(entries)) {
    if (!EXPORTABLE_LOCAL_STORAGE_KEYS.has(key)) continue
    localStorage.setItem(key, value)
    applied += 1
  }
  return applied
}

function sanitizeServerForStore(
  server: ExportedServerConnection,
): ServerConnection {
  return {
    ...server,
    status: 'disconnected',
    config: {
      ...server.config,
      password: '',
    },
  }
}

async function applyMultiServerConfig(
  input?: AppSettingsExport['multiServer'],
): Promise<number> {
  if (!input) {
    const empty: MultiServerConfig = { servers: [], activeServerId: null }
    multiServerStoreSetters.replaceAll(empty)
    saveMultiServerConfig(empty)
    return 0
  }

  const sanitizedServers = input.servers.map((server) =>
    sanitizeServerForStore(server),
  )

  const activeServerId = sanitizedServers.some(
    (server) => server.id === input.activeServerId,
  )
    ? input.activeServerId
    : (sanitizedServers[0]?.id ?? null)

  const sanitizedConfig: MultiServerConfig = {
    servers: sanitizedServers,
    activeServerId,
  }

  multiServerStoreSetters.replaceAll(sanitizedConfig)
  saveMultiServerConfig(sanitizedConfig)

  await Promise.all(
    input.servers.map(async (server) => {
      const password = server.config.password ?? ''
      if (!password) return
      await saveServerPassword(server.id, password)
    }),
  )

  return sanitizedServers.length
}

async function applyDesktopAppSettings(
  input?: DesktopAppSettingsExport,
): Promise<number> {
  if (!ELECTRON) return 0
  if (!input) return 0

  const service = ipcServices?.appSettings
  if (!service) return 0

  let applied = 0

  if (
    hasOwn(input, 'chromeExecutablePath') &&
    service.setChromeExecutablePath
  ) {
    const chromeExecutablePath =
      typeof input.chromeExecutablePath === 'string'
        ? input.chromeExecutablePath
        : null

    await service.setChromeExecutablePath({ chromeExecutablePath })
    applied += 1
  }

  if (
    hasOwn(input, 'aiPreferredProviders') &&
    service.setAiPreferredProviders
  ) {
    const normalized = normalizeAiProviderOrder(input.aiPreferredProviders)
    await service.setAiPreferredProviders({
      preferredProviders: normalized,
    })
    applied += 1
  }

  return applied
}

const apiTokenSlotMap = new Map(API_TOKEN_SLOTS.map((slot) => [slot.id, slot]))

function resolveTokenEncryptionPreference(id: string): 'safeStorage' | 'plain' {
  const definition = apiTokenSlotMap.get(id as ApiTokenSlotId)
  if (!definition) return 'safeStorage'
  const type = definition.inputType
  return type === 'text' || type === 'url' ? 'plain' : 'safeStorage'
}

async function applyApiTokens(
  input?: AppSettingsExport['apiTokens'],
): Promise<number> {
  if (!ELECTRON) return 0
  if (!input) return 0

  const service = ipcServices?.apiTokens
  if (!service?.listSlots || !service.clearValue || !service.setValue) {
    return 0
  }

  try {
    const existing = await service.listSlots()
    await Promise.all(
      existing
        .filter((summary) => summary?.hasValue && summary.id)
        .map((summary) => service.clearValue(summary.id)),
    )
  } catch (error) {
    console.error(
      '[settings-import] failed to clear existing api tokens',
      error,
    )
  }

  let applied = 0

  for (const slot of input.slots) {
    if (!slot?.id) continue
    const value = typeof slot.value === 'string' ? slot.value.trim() : ''
    if (!value) continue

    try {
      await service.setValue({
        id: slot.id,
        value,
        encryption: resolveTokenEncryptionPreference(slot.id),
      })
      applied += 1
    } catch (error) {
      console.error('[settings-import] failed to restore api token', {
        id: slot.id,
        error,
      })
    }
  }

  return applied
}

export async function importAppSettings(
  data: string | AppSettingsExport,
): Promise<AppSettingsImportResult> {
  const raw = typeof data === 'string' ? JSON.parse(data) : data
  const parsed = appSettingsExportSchema.parse(raw)

  const appliedLocalStorage = applyLocalStorageEntries(parsed.localStorage)
  const importedServers = await applyMultiServerConfig(parsed.multiServer)
  const appliedDesktopSettings = await applyDesktopAppSettings(
    parsed.desktopAppSettings,
  )
  const appliedApiTokens = await applyApiTokens(parsed.apiTokens)

  setTimeout(() => {
    window.location.reload()
  }, 1000)
  return {
    appliedLocalStorage,
    importedServers,
    appliedDesktopSettings,
    appliedApiTokens,
  }
}
