import { resolve } from 'node:path'

import { app } from 'electron'

import { getLogger } from '../config/log-config'
import type { WindowContentLoader } from '../types/window-manager.types'

export interface ContentLoaderOptions {
  isDevelopment?: boolean
  devServerPort?: number
  devServerHost?: string
}

export class DefaultWindowContentLoader implements WindowContentLoader {
  public readonly isDevelopment: boolean
  public readonly devServerPort: number
  public readonly devServerHost: string
  private readonly logger = getLogger('ContentLoader')

  constructor(options: ContentLoaderOptions = {}) {
    this.isDevelopment =
      options.isDevelopment ??
      (process.env.NODE_ENV === 'development' || !app.isPackaged)
    this.devServerPort = options.devServerPort ?? 5173
    this.devServerHost = options.devServerHost ?? 'localhost'

    this.logger.debug('DefaultWindowContentLoader initialized', {
      isDevelopment: this.isDevelopment,
      devServerPort: this.devServerPort,
      devServerHost: this.devServerHost,
    })
  }

  /**
   * Get the preload script path
   */
  getPreloadPath(): string {
    return resolve(__dirname, '../preload/index.cjs')
  }

  /**
   * Get the production index.html path
   */
  getProductionIndexPath(): string {
    const indexPath = resolve(__dirname, '../renderer/index.html')
    this.logger.debug('Getting production index path', {
      resolvedPath: indexPath,
      __dirname,
    })
    return indexPath
  }

  /**
   * Get the development server URL
   */
  getDevServerUrl(): string {
    return `http://${this.devServerHost}:${this.devServerPort}`
  }

  /**
   * Wait for development server to be ready
   */
  async waitForDevServer(timeout = 30000): Promise<void> {
    if (!this.isDevelopment) {
      return
    }

    const url = this.getDevServerUrl()
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(url)
        if (response.ok) {
          return
        }
      } catch {
        // Server not ready yet
      }

      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    throw new Error(
      `Development server at ${url} did not respond within ${timeout}ms`,
    )
  }
}
