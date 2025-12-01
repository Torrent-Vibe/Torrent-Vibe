import { atom } from 'jotai'

import { createAtomHooks } from '~/lib/jotai'
import type { ServerInfo } from '~/shared/types/qbittorrent'

// Connection status
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
export const connectionStatusAtom = atom<ConnectionStatus>('disconnected')

// Authentication status
export type AuthStatus =
  | 'authenticated'
  | 'unauthenticated'
  | 'authenticating'
  | 'auth_failed'
export const authStatusAtom = atom<AuthStatus>('unauthenticated')

// Error state
export const lastConnectionErrorAtom = atom<string | null>(null)
export const lastAuthErrorAtom = atom<string | null>(null)

// Server information
export const serverInfoAtom = atom<ServerInfo | null>(null)

// Auto-connect settings
export const autoConnectAtom = atom<boolean>(false)
export const rememberCredentialsAtom = atom<boolean>(false)

// Connection statistics
export const connectionStatsAtom = atom({
  connectedAt: null as Date | null,
  lastSyncAt: null as Date | null,
  reconnectAttempts: 0,
  totalUptime: 0,
})

// Create hooks for all atoms

export const [
  connectionStatusAtomInternal,
  useConnectionStatus,
  useConnectionStatusValue,
  useSetConnectionStatus,
] = createAtomHooks(connectionStatusAtom)

export const [
  lastConnectionErrorAtomInternal,
  useLastConnectionError,
  useLastConnectionErrorValue,
  useSetLastConnectionError,
] = createAtomHooks(lastConnectionErrorAtom)

export const [
  authStatusAtomInternal,
  useAuthStatus,
  useAuthStatusValue,
  useSetAuthStatus,
] = createAtomHooks(authStatusAtom)

export const [
  lastAuthErrorAtomInternal,
  useLastAuthError,
  useLastAuthErrorValue,
  useSetLastAuthError,
] = createAtomHooks(lastAuthErrorAtom)

export const [
  serverInfoAtomInternal,
  useServerInfo,
  useServerInfoValue,
  useSetServerInfo,
] = createAtomHooks(serverInfoAtom)

export const [
  autoConnectAtomInternal,
  useAutoConnect,
  useAutoConnectValue,
  useSetAutoConnect,
] = createAtomHooks(autoConnectAtom)

export const [
  rememberCredentialsAtomInternal,
  useRememberCredentials,
  useRememberCredentialsValue,
  useSetRememberCredentials,
] = createAtomHooks(rememberCredentialsAtom)

export const [
  connectionStatsAtomInternal,
  useConnectionStats,
  useConnectionStatsValue,
  useSetConnectionStats,
] = createAtomHooks(connectionStatsAtom)

// Derived atoms
export const isConnectedAtom = atom(
  (get) => get(connectionStatusAtom) === 'connected',
)

export const isConnectingAtom = atom(
  (get) => get(connectionStatusAtom) === 'connecting',
)

export const hasErrorAtom = atom((get) => get(connectionStatusAtom) === 'error')

export const useIsConnected = () => {
  const status = useConnectionStatusValue()
  return status === 'connected'
}

export const useIsConnecting = () => {
  const status = useConnectionStatusValue()
  return status === 'connecting'
}

export const useHasError = () => {
  const status = useConnectionStatusValue()
  return status === 'error'
}

export const useIsAuthenticated = () => {
  const status = useAuthStatusValue()
  return status === 'authenticated'
}

export const useIsAuthenticating = () => {
  const status = useAuthStatusValue()
  return status === 'authenticating'
}

export const useHasAuthError = () => {
  const status = useAuthStatusValue()
  return status === 'auth_failed'
}

export const useShouldDisableQueries = () => {
  const authStatus = useAuthStatusValue()
  const connectionStatus = useConnectionStatusValue()

  // Disable queries if auth failed or connection is down
  return (
    authStatus === 'auth_failed' ||
    connectionStatus === 'error' ||
    connectionStatus === 'disconnected'
  )
}
