import { discoverHelper, normalizeHelperBaseUrl, pairHelper } from './api'
import {
  listServerHelperTargets,
  ownerOfHelperUrl,
  setHelperBinding,
  useHelperBindingsStore,
} from './bindings'

export type ConnectHelperError = 'urlInUse' | 'discoverFailed' | 'pairFailed'

export type ConnectHelperResult
  = | { ok: true, url: string }
    | { ok: false, error: ConnectHelperError, owner?: string }

export const connectHelper = async (
  serverId: string,
  url: string,
): Promise<ConnectHelperResult> => {
  const normalized = normalizeHelperBaseUrl(url)
  if (!normalized) {
    return { ok: false, error: 'discoverFailed' }
  }

  const bindings = useHelperBindingsStore.getState().bindings
  const owner = ownerOfHelperUrl(normalized, bindings, serverId)
  if (owner) {
    return { ok: false, error: 'urlInUse', owner }
  }

  let info
  try {
    info = await discoverHelper(normalized)
  }
  catch {
    return { ok: false, error: 'discoverFailed' }
  }

  if (!info.pairingCode) {
    return { ok: false, error: 'pairFailed' }
  }

  try {
    const { token } = await pairHelper(normalized, info.pairingCode)
    setHelperBinding(serverId, { url: normalized, token })
  }
  catch (error) {
    if (error instanceof Error && error.message === 'helperUrlInUse') {
      return { ok: false, error: 'urlInUse', owner: normalized }
    }
    return { ok: false, error: 'pairFailed' }
  }

  return { ok: true, url: normalized }
}

export const helperOwnerName = (owner?: string): string => {
  if (!owner) {
    return ''
  }
  return (
    listServerHelperTargets().find(target => target.id === owner)?.name
    ?? owner
  )
}
