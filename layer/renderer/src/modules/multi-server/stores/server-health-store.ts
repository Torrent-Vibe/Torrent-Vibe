import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createWithEqualityFn } from 'zustand/traditional'

import type { ServerHealthResult } from '../types/multi-server'

interface ServerHealthState {
  results: Record<string, ServerHealthResult>
}

interface ServerHealthActions {
  setHealth: (serverId: string, result: ServerHealthResult) => void
  remove: (serverId: string) => void
  reset: () => void
}

export type ServerHealthStore = ServerHealthState & ServerHealthActions

export const useServerHealthStore = createWithEqualityFn<ServerHealthStore>()(
  subscribeWithSelector(
    immer((set) => ({
      results: {},
      setHealth: (serverId, result) =>
        set((draft) => {
          draft.results[serverId] = result
        }),
      remove: (serverId) =>
        set((draft) => {
          delete draft.results[serverId]
        }),
      reset: () =>
        set((draft) => {
          draft.results = {}
        }),
    })),
  ),
)

export const serverHealthSetters = {
  setHealth: (id: string, r: ServerHealthResult) =>
    useServerHealthStore.getState().setHealth(id, r),
  remove: (id: string) => useServerHealthStore.getState().remove(id),
  reset: () => useServerHealthStore.getState().reset(),
}
