import { useMemo } from 'react'

import { useMultiServerStore } from '~/modules/multi-server/stores/multi-server-store'

import {
  listServerHelperTargets,
  resolveCurrentServerId,
  useHelperBindingsStore,
} from './bindings'
import { WEB_SERVER_ID } from './types'

export const useHelperBindings = () =>
  useHelperBindingsStore(state => state.bindings)

export const useServerHelperTargets = () => {
  const bindings = useHelperBindings()
  const order = useMultiServerStore(state => state.order)
  const servers = useMultiServerStore(state => state.servers)
  return useMemo(() => {
    void bindings
    void order
    void servers
    return listServerHelperTargets()
  }, [bindings, order, servers])
}

export const useCurrentServerId = () => {
  const activeServerId = useMultiServerStore(state => state.activeServerId)
  if (typeof ELECTRON !== 'undefined' && ELECTRON) {
    return activeServerId
  }
  return WEB_SERVER_ID
}

export const useCurrentHelperPaired = () => {
  const bindings = useHelperBindings()
  const serverId = useCurrentServerId()
  return Boolean(serverId && bindings[serverId])
}

export const useCurrentHelperTarget = () => {
  const targets = useServerHelperTargets()
  const serverId = useCurrentServerId()
  return targets.find(target => target.id === serverId) ?? null
}

export { resolveCurrentServerId }
