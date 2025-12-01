import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createWithEqualityFn } from 'zustand/traditional'

import type { MultiServerConfig, ServerConnection } from '../types/multi-server'

interface MultiServerState {
  servers: Record<string, ServerConnection>
  order: string[]
  activeServerId: string | null
  switchingToServerId: string | null
}

interface MultiServerActions {
  addServer: (server: ServerConnection) => void
  updateServer: (serverId: string, patch: Partial<ServerConnection>) => void
  removeServer: (serverId: string) => void
  setActiveServer: (serverId: string | null) => void
  setSwitching: (serverId: string | null) => void
  replaceAll: (config: MultiServerConfig) => void
}

export type MultiServerStore = MultiServerState & MultiServerActions

export const useMultiServerStore = createWithEqualityFn<MultiServerStore>()(
  subscribeWithSelector(
    immer((set) => ({
      servers: {},
      order: [],
      activeServerId: null,
      switchingToServerId: null,

      addServer: (server) =>
        set((draft) => {
          draft.servers[server.id] = server
          if (!draft.order.includes(server.id)) draft.order.push(server.id)
          if (server.isDefault && !draft.activeServerId) {
            draft.activeServerId = server.id
          }
        }),

      updateServer: (serverId, patch) =>
        set((draft) => {
          const s = draft.servers[serverId]
          if (!s) return
          Object.assign(s, patch)
        }),

      removeServer: (serverId) =>
        set((draft) => {
          delete draft.servers[serverId]
          draft.order = draft.order.filter((id) => id !== serverId)
          if (draft.activeServerId === serverId) {
            draft.activeServerId = draft.order[0] ?? null
          }
        }),

      setActiveServer: (serverId) =>
        set((draft) => {
          draft.activeServerId = serverId
        }),

      setSwitching: (serverId) =>
        set((draft) => {
          draft.switchingToServerId = serverId
        }),

      replaceAll: (config) =>
        set((draft) => {
          draft.servers = Object.fromEntries(
            config.servers.map((s) => [s.id, s]),
          ) as Record<string, ServerConnection>
          draft.order = config.servers.map((s) => s.id)
          draft.activeServerId = config.activeServerId
        }),
    })),
  ),
)

export const multiServerStoreSetters: Pick<
  MultiServerActions,
  | 'addServer'
  | 'updateServer'
  | 'removeServer'
  | 'setActiveServer'
  | 'setSwitching'
  | 'replaceAll'
> = {
  addServer: (server) => useMultiServerStore.getState().addServer(server),
  updateServer: (id, patch) =>
    useMultiServerStore.getState().updateServer(id, patch),
  removeServer: (id) => useMultiServerStore.getState().removeServer(id),
  setActiveServer: (id) => useMultiServerStore.getState().setActiveServer(id),
  setSwitching: (id) => useMultiServerStore.getState().setSwitching(id),
  replaceAll: (config) => useMultiServerStore.getState().replaceAll(config),
}
