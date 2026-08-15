import { subscribeWithSelector } from 'zustand/middleware'
import { createWithEqualityFn } from 'zustand/traditional'

import { storage, STORAGE_KEYS } from '~/lib/storage-keys'
import { useMultiServerStore } from '~/modules/multi-server/stores/multi-server-store'
import { loadStoredConnectionConfig } from '~/shared/config'

import type { HelperBinding, ServerHelperTarget } from './types'
import { WEB_SERVER_ID } from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

const parseBinding = (value: unknown): HelperBinding | null => {
  if (!isRecord(value)) {
    return null
  }
  if (typeof value.url !== 'string' || typeof value.token !== 'string') {
    return null
  }
  if (!value.url.trim() || !value.token.trim()) {
    return null
  }
  return { url: value.url.trim(), token: value.token }
}

const loadHelperBindingsFromStorage = (): Record<string, HelperBinding> => {
  const stored = storage.getJSON<unknown>(STORAGE_KEYS.HELPER_BINDINGS)
  if (!isRecord(stored)) {
    return {}
  }
  const next: Record<string, HelperBinding> = {}
  for (const [serverId, value] of Object.entries(stored)) {
    const parsed = parseBinding(value)
    if (parsed) {
      next[serverId] = parsed
    }
  }
  return next
}

export const useHelperBindingsStore = createWithEqualityFn<{
  bindings: Record<string, HelperBinding>
}>()(
  subscribeWithSelector(() => ({
    bindings: loadHelperBindingsFromStorage(),
  })),
)

export const loadHelperBindings = (): Record<string, HelperBinding> =>
  useHelperBindingsStore.getState().bindings

export const saveHelperBindings = (
  bindings: Record<string, HelperBinding>,
): void => {
  storage.setJSON(STORAGE_KEYS.HELPER_BINDINGS, bindings)
  useHelperBindingsStore.setState({ bindings })
}

export const getHelperBinding = (serverId: string): HelperBinding | null =>
  loadHelperBindings()[serverId] ?? null

export const setHelperBinding = (
  serverId: string,
  binding: HelperBinding,
): void => {
  const next = { ...loadHelperBindings() }
  next[serverId] = {
    url: binding.url.trim().replace(/\/+$/, ''),
    token: binding.token,
  }
  saveHelperBindings(next)
}

export const clearHelperBinding = (serverId: string): void => {
  const next = { ...loadHelperBindings() }
  delete next[serverId]
  saveHelperBindings(next)
}

export const isHelperPaired = (serverId: string): boolean =>
  getHelperBinding(serverId) !== null

export const resolveCurrentServerId = (): string | null => {
  if (typeof ELECTRON !== 'undefined' && ELECTRON) {
    return useMultiServerStore.getState().activeServerId
  }
  return WEB_SERVER_ID
}

const webHost = (): string => {
  const stored = loadStoredConnectionConfig().stored
  if (stored?.host) {
    return stored.host
  }
  if (typeof window !== 'undefined') {
    return window.location.hostname
  }
  return 'localhost'
}

export const listServerHelperTargets = (): ServerHelperTarget[] => {
  const bindings = loadHelperBindings()
  if (typeof ELECTRON !== 'undefined' && ELECTRON) {
    const { order, servers } = useMultiServerStore.getState()
    return order.flatMap((id) => {
      const server = servers[id]
      if (!server) {
        return []
      }
      return [
        {
          id,
          name: server.name,
          host: server.config.host,
          paired: Boolean(bindings[id]),
        },
      ]
    })
  }
  return [
    {
      id: WEB_SERVER_ID,
      name: webHost(),
      host: webHost(),
      paired: Boolean(bindings[WEB_SERVER_ID]),
    },
  ]
}

export const currentServerHelperTarget = (): ServerHelperTarget | null => {
  const currentId = resolveCurrentServerId()
  if (!currentId) {
    return null
  }
  return (
    listServerHelperTargets().find(target => target.id === currentId) ?? null
  )
}

export const currentServerHasHelper = (): boolean => {
  const currentId = resolveCurrentServerId()
  return currentId ? isHelperPaired(currentId) : false
}
