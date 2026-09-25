import { APP_LATEST_RELEASE_URL } from '@torrent-vibe/shared'
import { app } from 'electron'
import log from 'electron-log'
import type { ProgressInfo, UpdateDownloadedEvent } from 'electron-updater'
import { autoUpdater } from 'electron-updater'

import type { UpdaterStatusStore, UpdaterUiStatus } from '~/updater/status'
import { createUpdaterStatusStore } from '~/updater/status'
import type { UpdaterHandle } from '~/updater/updater'

/**
 * AppAutoUpdater integrates electron-updater to provide full application updates
 * from GitHub Releases (electron-builder generates app-update.yml from its publish
 * config at package time). It auto-downloads updates and reports progress through the
 * status store; the renderer prompts for restart. Used on Windows/Linux only; macOS
 * updates run through Sparkle.
 */
export class AppAutoUpdater implements UpdaterHandle {
  private static _instance: AppAutoUpdater | null = null
  private logger = log.scope('AppAutoUpdater')
  private status: UpdaterStatusStore = createUpdaterStatusStore()
  private initialized = false
  private installRequested = false

  static get instance(): AppAutoUpdater {
    if (!this._instance) {
      this._instance = new AppAutoUpdater()
    }
    return this._instance
  }

  initialize(): void {
    if (process.platform === 'darwin') {
      return
    }
    if (this.initialized) {
      return
    }
    try {
      autoUpdater.logger = log
      autoUpdater.autoDownload = true
      autoUpdater.autoInstallOnAppQuit = false

      // Honor prerelease channel when app version contains pre tags
      autoUpdater.allowPrerelease = /-(?:alpha|beta|rc)\./i.test(
        app.getVersion?.() || '',
      )

      this.registerEvents()
      this.initialized = true
      this.logger.info('AppAutoUpdater initialized')
    } catch (e) {
      this.logger.error('Failed to initialize AppAutoUpdater:', e)
    }
  }

  checkForUpdates(): void {
    try {
      this.logger.info('Checking for application updates via electron-updater')
      void autoUpdater.checkForUpdates()
    } catch (e) {
      this.logger.error('checkForUpdates failed:', e)
    }
  }

  checkNow(): void {
    this.checkForUpdates()
  }

  silentCheckOnActivate(): void {
    this.checkForUpdates()
  }

  installNow(): void {
    const current = this.status.get()
    if (current.kind === 'ready') {
      this.quitAndInstall()
      return
    }
    this.installRequested = true
    if (current.kind !== 'downloading') {
      this.checkForUpdates()
    }
  }

  private quitAndInstall(): void {
    try {
      autoUpdater.quitAndInstall(false, true)
    } catch (e) {
      this.logger.error('quitAndInstall failed:', e)
    }
  }

  getStatus(): UpdaterUiStatus {
    return this.status.get()
  }

  onStatus(cb: (status: UpdaterUiStatus) => void): () => void {
    return this.status.on(cb)
  }

  private registerEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      this.logger.info('electron-updater: checking for update')
    })

    autoUpdater.on('update-available', (info) => {
      this.logger.info('electron-updater: update available', info?.version)
      this.status.set({
        kind: 'available',
        version: info?.version || '',
        htmlUrl: APP_LATEST_RELEASE_URL,
      })
    })

    autoUpdater.on('update-not-available', (info) => {
      this.logger.info('electron-updater: update not available', info?.version)
      this.status.set({
        kind: 'up-to-date',
        current: app.getVersion?.() || '',
        latest: info?.version || app.getVersion?.() || '',
      })
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.logger.debug(
        `electron-updater: download ${Math.round(progress.percent)}% (${progress.transferred}/${progress.total})`,
      )
      const current = this.status.get()
      this.status.set({
        kind: 'downloading',
        version:
          current.kind === 'available' || current.kind === 'downloading'
            ? current.version
            : '',
        percent: Math.floor(progress.percent),
      })
    })

    autoUpdater.on('update-downloaded', (event: UpdateDownloadedEvent) => {
      this.logger.info('electron-updater: update downloaded', event?.version)
      this.status.set({ kind: 'ready', version: event?.version || '' })
      if (this.installRequested) {
        this.quitAndInstall()
      }
    })

    autoUpdater.on('error', (err: Error) => {
      this.logger.error('electron-updater error:', err)
      this.installRequested = false
      this.status.set({ kind: 'error', message: err?.message || String(err) })
    })
  }
}
