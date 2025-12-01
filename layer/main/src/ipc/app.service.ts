import { app, nativeTheme, shell } from 'electron'
import type { IpcContext } from 'electron-ipc-decorator'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

import { WindowManager } from '~/manager/window-manager'
import { UpdateService } from '~/services/update-service'
import { i18n } from '~/utils/i18n'

export class AppService extends IpcService {
  static override readonly groupName = 'app'

  @IpcMethod()
  getAppearance(): string {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  }

  @IpcMethod()
  setAppearance(
    context: IpcContext,
    appearance: 'dark' | 'light' | 'system',
  ): void {
    nativeTheme.themeSource = appearance
  }

  @IpcMethod()
  openUrl(context: IpcContext, url: string): void {
    shell.openExternal(url)
  }

  @IpcMethod()
  async checkForUpdate() {
    UpdateService.shared.checkAndPrepareUpdate()
  }

  @IpcMethod()
  async reload(_context: IpcContext) {
    WindowManager.getInstance().reloadWindowContent()
  }

  @IpcMethod()
  async setMainLanguage(context: IpcContext, language: string) {
    try {
      await i18n.changeLanguage(language)
      return { ok: true }
    } catch (e: unknown) {
      console.error('Failed to change main process language:', e)
      const error = e as Error
      return { ok: false, error: String(error?.message || e) }
    }
  }

  @IpcMethod()
  getVersions(): {
    appVersion: string
    appBuildTime: string | null
    rendererVersion: string | null
    rendererSource: 'hot-update' | 'bundled' | 'dev'
  } {
    // App version: prefer app.getVersion(); if placeholder, derive from __BUILD_TIME__
    const raw = app.getVersion?.() || ''
    let appVersion = raw
    const buildTime: string | null =
      typeof __BUILD_TIME__ !== 'undefined' ? String(__BUILD_TIME__) : null
    if ((!appVersion || appVersion === '0.0.0') && buildTime) {
      const d = new Date(buildTime)
      if (!Number.isNaN(d.getTime())) {
        const pad = (n: number) => n.toString().padStart(2, '0')
        const tag = `v${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
        appVersion = tag
      }
    }

    // Renderer version: what WindowManager actually loaded
    const info = WindowManager.getInstance().getRendererInfo()
    const rendererVersion: string | null = info?.version ?? null
    const rendererSource: 'hot-update' | 'bundled' | 'dev' =
      info?.source ?? 'bundled'

    return {
      appVersion,
      appBuildTime: buildTime,
      rendererVersion,
      rendererSource,
    }
  }
}
