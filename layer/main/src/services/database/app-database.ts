import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import type sqlite3Type from 'sqlite3'
import type { Database as SqliteDatabase } from 'sqlite3'

import { getLogger } from '~/config/log-config'
import { getAppDatabaseDir } from '~/config/paths'

import { runAppDatabaseMigrations } from './migrations'
import { close, exec } from './sqlite-utils'

const sqlite3 = require('sqlite3') as typeof sqlite3Type

const DB_FILE_NAME = 'app.sqlite'

const logger = getLogger('[app-db]')

sqlite3.verbose()

const ensureDirectory = (path: string) => {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
  }
}

export class AppDatabase {
  private static instance: AppDatabase | null = null

  static getInstance(): AppDatabase {
    if (!this.instance) {
      this.instance = new AppDatabase()
    }

    return this.instance
  }

  private readonly sqlite!: SqliteDatabase
  private readonly readyPromise: Promise<void>

  private constructor() {
    const directory = getAppDatabaseDir()
    ensureDirectory(directory)

    const filePath = join(directory, DB_FILE_NAME)

    this.sqlite = new sqlite3.Database(filePath)

    this.readyPromise = (async () => {
      try {
        await exec(this.sqlite, 'PRAGMA journal_mode = WAL')
        await exec(this.sqlite, 'PRAGMA foreign_keys = ON')
        await runAppDatabaseMigrations(this.sqlite, logger)
      } catch (error) {
        logger.error('Failed to initialize application database', error)

        try {
          await close(this.sqlite)
        } catch (closeError) {
          logger.warn(
            'Failed to close application database after initialization error',
            closeError,
          )
        }

        throw error
      }
    })()
  }

  getSqlite(): SqliteDatabase {
    return this.sqlite
  }

  async waitUntilReady(): Promise<void> {
    await this.readyPromise
  }
}
