import { getI18n } from '~/i18n'
import { jotaiStore } from '~/lib/jotai'
import { qbQueryManager } from '~/lib/query/query-manager-instance'
import {
  loadMultiServerConfig,
  loadServerPassword,
} from '~/modules/multi-server/utils/server-config'
import { router } from '~/router'
import { QBittorrentClient } from '~/shared/api/qbittorrent-client'
import { loadStoredConnectionConfig } from '~/shared/config'
import type { QBittorrentConfig } from '~/shared/types/qbittorrent'

import {
  authStatusAtom,
  connectionStatusAtom,
  lastAuthErrorAtom,
  lastConnectionErrorAtom,
} from './atoms/connection'

export class AuthManager {
  private static instance: AuthManager | null = null
  private refreshTimer: NodeJS.Timeout | null = null
  private isRefreshing = false

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager()
    }
    return AuthManager.instance
  }

  /**
   * Load connection config for current environment
   * - Electron: use active server from multi-server config
   * - Web: use legacy single-server stored config
   */
  async loadUniversalConnectionConfig(): Promise<
    QBittorrentConfig | undefined
  > {
    try {
      if (ELECTRON) {
        const ms = loadMultiServerConfig()
        const active = ms.activeServerId
          ? ms.servers.find((s) => s.id === ms.activeServerId)
          : ms.servers[0]
        if (!active) return undefined

        const pwd = await loadServerPassword(active.id)
        if (!pwd) return undefined

        return { ...active.config, password: pwd }
      }

      const { stored, password } = loadStoredConnectionConfig()
      if (!stored || !password) return undefined

      return {
        host: stored.host,
        port: stored.port,
        username: stored.username,
        password,
        useHttps: stored.useHttps,
        baseUrl: stored.baseUrl,
      }
    } catch {
      return undefined
    }
  }
  /**
   * Initialize authentication on app start
   * Attempts to refresh login with stored credentials
   */
  async initialize(): Promise<void> {
    try {
      jotaiStore.set(authStatusAtom, 'authenticating')
      jotaiStore.set(lastAuthErrorAtom, null)

      const config = await this.loadUniversalConnectionConfig()

      if (!config) {
        jotaiStore.set(authStatusAtom, 'unauthenticated')
        jotaiStore.set(connectionStatusAtom, 'disconnected')

        router.navigate('/onboarding')
        return
      }

      // Configure client with stored credentials
      QBittorrentClient.configure(config)

      // Clear cache since we're connecting to a potentially different server
      await qbQueryManager.scenarios.onConnectionChange()

      // Attempt login
      const loginSuccess = await this.performLogin()

      if (loginSuccess) {
        jotaiStore.set(authStatusAtom, 'authenticated')
        jotaiStore.set(connectionStatusAtom, 'connected')
        this.startPeriodicRefresh()
      } else {
        jotaiStore.set(authStatusAtom, 'auth_failed')
        jotaiStore.set(connectionStatusAtom, 'error')
        jotaiStore.set(
          lastAuthErrorAtom,
          'Authentication failed with stored credentials',
        )
      }
    } catch (error) {
      console.error(`${getI18n().t('messages.authRetryFailed')}:`, error)
      jotaiStore.set(authStatusAtom, 'auth_failed')
      jotaiStore.set(connectionStatusAtom, 'error')
      jotaiStore.set(lastAuthErrorAtom, this.parseErrorMessage(error))
    }
  }

  /**
   * Refresh authentication - called periodically and on 401 errors
   */
  async refreshAuth(): Promise<boolean> {
    if (this.isRefreshing) {
      return false
    }

    this.isRefreshing = true

    try {
      jotaiStore.set(authStatusAtom, 'authenticating')
      jotaiStore.set(lastAuthErrorAtom, null)

      const loginSuccess = await this.performLogin()

      if (loginSuccess) {
        jotaiStore.set(authStatusAtom, 'authenticated')
        jotaiStore.set(connectionStatusAtom, 'connected')
        jotaiStore.set(lastConnectionErrorAtom, null)
        return true
      } else {
        jotaiStore.set(authStatusAtom, 'auth_failed')
        jotaiStore.set(connectionStatusAtom, 'error')
        jotaiStore.set(lastAuthErrorAtom, 'Authentication refresh failed')
        this.stopPeriodicRefresh()
        return false
      }
    } catch (error) {
      console.error(`${getI18n().t('messages.authRetryFailed')}:`, error)
      jotaiStore.set(authStatusAtom, 'auth_failed')
      jotaiStore.set(connectionStatusAtom, 'error')
      jotaiStore.set(lastAuthErrorAtom, this.parseErrorMessage(error))
      jotaiStore.set(lastConnectionErrorAtom, this.parseErrorMessage(error))
      this.stopPeriodicRefresh()
      return false
    } finally {
      this.isRefreshing = false
    }
  }

  /**
   * Handle 401 unauthorized responses
   */
  async handle401Error(): Promise<boolean> {
    console.warn(
      `${getI18n().t('messages.authRetryFailed')} - 401 Unauthorized detected, attempting auth refresh`,
    )
    return await this.refreshAuth()
  }

  /**
   * Start periodic authentication refresh
   */
  private startPeriodicRefresh(): void {
    this.stopPeriodicRefresh() // Clear any existing timer

    // Refresh auth every 30 minutes to keep session alive
    this.refreshTimer = setInterval(
      () => {
        this.refreshAuth()
      },
      30 * 60 * 1000,
    ) // 30 minutes
  }

  /**
   * Stop periodic authentication refresh
   */
  private stopPeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  /**
   * Perform the actual login request
   */
  private async performLogin(): Promise<boolean> {
    try {
      const result = await QBittorrentClient.shared.login()
      return result === true
    } catch (error) {
      console.error(`${getI18n().t('messages.authRetryFailed')}:`, error)
      return false
    }
  }

  /**
   * Parse error message from various error types
   */
  private parseErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      if (message.includes('401') || message.includes('unauthorized')) {
        return 'Invalid username or password'
      }

      if (
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('timeout')
      ) {
        return 'Network error - unable to reach qBittorrent server'
      }

      return error.message
    }

    return 'Unknown authentication error'
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopPeriodicRefresh()
    AuthManager.instance = null
  }
}

// Export singleton instance
export const authManager = AuthManager.getInstance()
