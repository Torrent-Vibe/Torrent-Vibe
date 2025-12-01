import { app, dialog } from 'electron'
import log from 'electron-log'
import type { ProgressInfo, UpdateDownloadedEvent } from 'electron-updater'
import { autoUpdater } from 'electron-updater'

/**
 * AppAutoUpdater integrates electron-updater to provide full application updates
 * from GitHub Releases defined by resources/app-update.yml. It auto-downloads
 * updates and prompts the user to restart when ready.
 */
export class AppAutoUpdater {
  private static _instance: AppAutoUpdater | null = null
  private logger = log.scope('AppAutoUpdater')

  static get instance(): AppAutoUpdater {
    if (!this._instance) this._instance = new AppAutoUpdater()
    return this._instance
  }

  initialize(): void {
    try {
      // Configure logger
      autoUpdater.logger = log
      autoUpdater.autoDownload = true
      autoUpdater.autoInstallOnAppQuit = false

      // Honor prerelease channel when app version contains pre tags
      autoUpdater.allowPrerelease = /-(?:alpha|beta|rc)\./i.test(
        app.getVersion?.() || '',
      )

      this.registerEvents()
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

  private registerEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      this.logger.info('electron-updater: checking for update')
    })

    autoUpdater.on('update-available', (info) => {
      this.logger.info('electron-updater: update available', info?.version)
    })

    autoUpdater.on('update-not-available', (info) => {
      this.logger.info('electron-updater: update not available', info?.version)
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.logger.debug(
        `electron-updater: download ${Math.round(progress.percent)}% (${progress.transferred}/${progress.total})`,
      )
    })

    autoUpdater.on(
      'update-downloaded',
      async (event: UpdateDownloadedEvent) => {
        try {
          this.logger.info(
            'electron-updater: update downloaded',
            event?.version,
          )
          const result = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Restart Now', 'Later'],
            defaultId: 0,
            cancelId: 1,
            title: 'Update Ready',
            message:
              'A new version has been downloaded. Restart the app to install now?',
            detail: `Version: ${event?.version || ''}`,
          })

          if (result.response === 0) {
            this.logger.info('Quitting and installing update...')
            // Quit and install immediately
            autoUpdater.quitAndInstall(false, true)
          } else {
            this.logger.info('User chose to install later')
          }
        } catch (e) {
          this.logger.error('Failed to prompt for update installation:', e)
        }
      },
    )

    autoUpdater.on('error', (err: Error) => {
      this.logger.error('electron-updater error:', err)
    })
  }
}
