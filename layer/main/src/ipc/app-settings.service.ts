import { existsSync, statSync } from 'node:fs'

import type { AiProviderId, SearchProviderId } from '@torrent-vibe/shared'
import { SEARCH_PROVIDER_IDS } from '@torrent-vibe/shared'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

import {
  agentBrowserManager,
  detectAgentBrowserCli,
} from '~/manager/agent-browser-manager'
import { AppSettingsStore } from '~/services/app-settings-store'

export class AppSettingsIPCService extends IpcService {
  static override readonly groupName = 'appSettings'

  private readonly store = AppSettingsStore.getInstance()

  @IpcMethod()
  getSearchSettings() {
    return {
      agentBrowserPath: this.store.getAgentBrowserPath(),
    }
  }

  @IpcMethod()
  getAiSettings() {
    return {
      preferredProviders: this.store.getPreferredAiProviders(),
      searchProvider: this.store.getSearchProvider(),
    }
  }

  @IpcMethod()
  setAgentBrowserPath(input: { agentBrowserPath: string | null }) {
    const normalized = input.agentBrowserPath?.trim()
    if (normalized) {
      if (!existsSync(normalized)) {
        return { ok: false, error: 'notFound' as const }
      }
      try {
        const stat = statSync(normalized)
        if (!stat.isFile()) {
          return { ok: false, error: 'notFile' as const }
        }
      }
      catch (error) {
        return {
          ok: false,
          error: 'notAccessible' as const,
          details: String((error as Error)?.message ?? error),
        }
      }
    }

    this.store.setAgentBrowserPath(normalized ?? null)
    agentBrowserManager.reset()

    return {
      ok: true,
      agentBrowserPath: this.store.getAgentBrowserPath(),
    }
  }

  @IpcMethod()
  setAiPreferredProviders(input: { preferredProviders: string[] }) {
    const sanitized = Array.isArray(input.preferredProviders)
      ? input.preferredProviders.filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0,
        )
      : []

    const resolved = this.store.setPreferredAiProviders(
      sanitized as AiProviderId[],
    )

    return {
      ok: true as const,
      preferredProviders: resolved,
    }
  }

  @IpcMethod()
  setAiSearchProvider(input: { searchProvider: string }) {
    const next = input.searchProvider
    const resolved = this.store.setSearchProvider(
      SEARCH_PROVIDER_IDS.includes(next as SearchProviderId)
        ? (next as SearchProviderId)
        : this.store.getSearchProvider(),
    )
    return {
      ok: true as const,
      searchProvider: resolved,
    }
  }

  @IpcMethod()
  detectAgentBrowser() {
    return {
      agentBrowserPath: detectAgentBrowserCli(),
    }
  }
}
