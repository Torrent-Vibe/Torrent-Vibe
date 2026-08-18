import { storage, STORAGE_KEYS } from '~/lib/storage-keys'

import { discoverHelper, normalizeHelperBaseUrl, pairHelper } from './api'
import {
  listServerHelperTargets,
  ownerOfHelperUrl,
  setHelperBinding,
  useHelperBindingsStore,
} from './bindings'

export type ConnectHelperError =
  'urlInUse' | 'discoverFailed' | 'pairFailed' | 'tooManyAttempts'

export type ConnectHelperResult =
  | { ok: true; url: string }
  | { ok: false; error: ConnectHelperError; owner?: string }

export const getHelperClientIdentity = (): { id: string; name: string } => {
  let id = storage.getItem(STORAGE_KEYS.HELPER_CLIENT_ID)
  if (!id) {
    id =
      globalThis.crypto?.randomUUID?.() ??
      `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    storage.setItem(STORAGE_KEYS.HELPER_CLIENT_ID, id)
  }
  const electron = typeof ELECTRON !== 'undefined' && ELECTRON
  return { id, name: electron ? 'Torrent Vibe Desktop' : 'Torrent Vibe Web' }
}

export const connectHelper = async (
  serverId: string,
  url: string,
  pairingCode: string,
): Promise<ConnectHelperResult> => {
  const normalized = normalizeHelperBaseUrl(url)
  const code = pairingCode.trim().toUpperCase()
  if (!normalized || !code) {
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
  } catch {
    return { ok: false, error: 'discoverFailed' }
  }

  if (!info.requiresPairingCode) {
    return { ok: false, error: 'pairFailed' }
  }

  try {
    const identity = getHelperClientIdentity()
    const { clientId, token } = await pairHelper(
      normalized,
      code,
      identity.id,
      identity.name,
    )
    setHelperBinding(serverId, { clientId, url: normalized, token })
  } catch (error) {
    if (error instanceof Error && error.message === 'helperUrlInUse') {
      return { ok: false, error: 'urlInUse', owner: normalized }
    }
    if ((error as { status?: number })?.status === 429) {
      return { ok: false, error: 'tooManyAttempts' }
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
    listServerHelperTargets().find((target) => target.id === owner)?.name ??
    owner
  )
}
