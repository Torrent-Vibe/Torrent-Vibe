import { subscribeWithSelector } from 'zustand/middleware'
import { createWithEqualityFn } from 'zustand/traditional'

import { storage, STORAGE_KEYS } from '~/lib/storage-keys'
import { useMultiServerStore } from '~/modules/multi-server/stores/multi-server-store'
import { loadStoredConnectionConfig } from '~/shared/config'

import { helperBindingsSchema } from './schema'
import type { HelperBinding, ServerHelperTarget } from './types'
import { WEB_SERVER_ID } from './types'

const loadHelperBindingsFromStorage = (): Record<string, HelperBinding> =>
  helperBindingsSchema.parse(
    storage.getJSON<unknown>(STORAGE_KEYS.HELPER_BINDINGS),
  )

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

export const ownerOfHelperUrl = (
  url: string,
  bindings: Record<string, HelperBinding>,
  exceptServerId?: string,
): string | null => {
  const normalized = url.trim().replace(/\/+$/, '')
  for (const [id, binding] of Object.entries(bindings)) {
    if (exceptServerId && id === exceptServerId) {
      continue
    }
    if (binding.url.trim().replace(/\/+$/, '') === normalized) {
      return id
    }
  }
  return null
}

export const setHelperBinding = (
  serverId: string,
  binding: HelperBinding,
): void => {
  const next = { ...loadHelperBindings() }
  const owner = ownerOfHelperUrl(binding.url, next, serverId)
  if (owner) {
    throw new Error('helperUrlInUse')
  }
  next[serverId] = {
    clientId: binding.clientId ?? 'legacy-desktop',
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
    listServerHelperTargets().find((target) => target.id === currentId) ?? null
  )
}

export const currentServerHasHelper = (): boolean => {
  const currentId = resolveCurrentServerId()
  return currentId ? isHelperPaired(currentId) : false
}
