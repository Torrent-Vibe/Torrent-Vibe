import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import semver from 'semver'

import { getUpdateDir } from '~/config/paths'

import { getLogger } from '../config/log-config'
import type { WindowContentLoader } from '../types/window-manager.types'

/**
 * Attempts to load renderer content from extracted hot update packages.
 * Falls back to the bundled renderer if no update is found.
 */
export class HotUpdateContentLoader implements WindowContentLoader {
  private readonly logger = getLogger('HotUpdateContentLoader')

  constructor(private fallback: WindowContentLoader) {
    this.logger.debug('HotUpdateContentLoader initialized with fallback')
  }

  get isDevelopment() {
    return this.fallback.isDevelopment
  }
  get devServerPort() {
    return this.fallback.devServerPort
  }
  get devServerHost() {
    return this.fallback.devServerHost
  }
  getPreloadPath() {
    return this.fallback.getPreloadPath()
  }

  getProductionIndexPath(): string {
    const updatesDir = getUpdateDir()
    this.logger.debug('Checking for hot updates', { updatesDir })

    if (existsSync(updatesDir)) {
      this.logger.debug('Updates directory exists, scanning for versions')

      const dirs = readdirSync(updatesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)

      this.logger.debug('Found directories in updates folder', {
        directories: dirs,
      })

      // Prefer semver sorting if names look like semver; otherwise fall back to latest mtime
      const semverish = dirs.filter((v) => semver.valid(semver.coerce(v) || ''))
      let latest: string | undefined
      if (semverish.length > 0) {
        const sorted = semverish
          .map((v) => semver.coerce(v)?.version || v)
          .sort(semver.compare)
        latest = sorted.at(-1) as string | undefined
        this.logger.debug('Using semver to select latest', {
          latest,
          candidates: semverish,
        })
      } else {
        // Fallback by directory mtime
        const withTimes = dirs
          .map((name) => {
            const p = join(updatesDir, name)
            try {
              const stat = statSync(p)
              return { name, mtime: stat.mtimeMs }
            } catch {
              return { name, mtime: 0 }
            }
          })
          .sort((a, b) => b.mtime - a.mtime)
        latest = withTimes[0]?.name
        this.logger.debug('Using mtime to select latest', { latest })
      }
      if (latest) {
        const indexPath = join(updatesDir, latest, 'index.html')
        this.logger.debug('Checking latest version index path', {
          latestVersion: latest,
          indexPath,
          exists: existsSync(indexPath),
        })

        if (existsSync(indexPath)) {
          this.logger.info('Using hot update version for renderer', {
            version: latest,
            indexPath,
          })
          return indexPath
        } else {
          this.logger.warn(
            'Latest version index.html not found, falling back',
            {
              latestVersion: latest,
              expectedPath: indexPath,
            },
          )
        }
      } else {
        this.logger.debug('No valid versions found in updates directory')
      }
    } else {
      this.logger.debug('Updates directory does not exist, using fallback')
    }

    const fallbackPath = this.fallback.getProductionIndexPath()
    this.logger.info('Using fallback renderer path', { fallbackPath })
    return fallbackPath
  }
}
