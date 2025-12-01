import { existsSync, statSync } from 'node:fs'

import type { AiProviderId } from '@torrent-vibe/shared'
import type { IpcContext } from 'electron-ipc-decorator'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

import { AppSettingsStore } from '~/services/app-settings-store'
import {
  chromeManager,
  detectChromeExecutable,
} from '~/services/torrent-ai/tools'

export class AppSettingsIPCService extends IpcService {
  static override readonly groupName = 'appSettings'

  private readonly store = AppSettingsStore.getInstance()

  @IpcMethod()
  getSearchSettings() {
    return {
      chromeExecutablePath: this.store.getChromeExecutablePath(),
    }
  }

  @IpcMethod()
  getAiSettings() {
    return {
      preferredProviders: this.store.getPreferredAiProviders(),
    }
  }

  @IpcMethod()
  async setChromeExecutablePath(
    _context: IpcContext,
    input: { chromeExecutablePath: string | null },
  ) {
    const normalized = input.chromeExecutablePath?.trim()
    if (normalized) {
      if (!existsSync(normalized)) {
        return { ok: false, error: 'notFound' as const }
      }
      try {
        const stat = statSync(normalized)
        if (!stat.isFile()) {
          return { ok: false, error: 'notFile' as const }
        }
      } catch (error) {
        return {
          ok: false,
          error: 'notAccessible' as const,
          details: String((error as Error)?.message ?? error),
        }
      }
    }

    this.store.setChromeExecutablePath(normalized ?? null)
    await chromeManager.dispose()

    return {
      ok: true,
      chromeExecutablePath: this.store.getChromeExecutablePath(),
    }
  }

  @IpcMethod()
  setAiPreferredProviders(
    _context: IpcContext,
    input: { preferredProviders: string[] },
  ) {
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
  detectChromeExecutable(_context: IpcContext) {
    return {
      chromeExecutablePath: detectChromeExecutable(),
    }
  }
}
