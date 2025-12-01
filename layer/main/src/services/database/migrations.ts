import type { LogFunctions } from 'electron-log'
import type { Database as SqliteDatabase } from 'sqlite3'

import { TORRENT_AI_METADATA_TABLE_NAME } from './schema'
import { all, exec, get } from './sqlite-utils'

type MigrationStep = {
  version: number
  name: string
  up: (db: SqliteDatabase) => Promise<void>
}

const MIGRATIONS: MigrationStep[] = [
  {
    version: 1,
    name: 'create torrent ai metadata table',
    up: async (db) => {
      await exec(
        db,
        `
        CREATE TABLE IF NOT EXISTS ${TORRENT_AI_METADATA_TABLE_NAME} (
          key TEXT PRIMARY KEY,
          metadata TEXT NOT NULL,
          provider TEXT NOT NULL DEFAULT 'legacy',
          model TEXT NOT NULL DEFAULT 'legacy',
          created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_${TORRENT_AI_METADATA_TABLE_NAME}_created_at
          ON ${TORRENT_AI_METADATA_TABLE_NAME} (created_at DESC);
      `,
      )
    },
  },
  {
    version: 2,
    name: 'ensure provider and model columns exist',
    up: async (db) => {
      const columns = await all<{ name: string }>(
        db,
        `PRAGMA table_info(${TORRENT_AI_METADATA_TABLE_NAME})`,
      )
      const columnNames = new Set(columns.map((column) => column.name))

      if (!columnNames.has('provider')) {
        await exec(
          db,
          `ALTER TABLE ${TORRENT_AI_METADATA_TABLE_NAME} ADD COLUMN provider TEXT NOT NULL DEFAULT 'legacy'`,
        )
      }

      if (!columnNames.has('model')) {
        await exec(
          db,
          `ALTER TABLE ${TORRENT_AI_METADATA_TABLE_NAME} ADD COLUMN model TEXT NOT NULL DEFAULT 'legacy'`,
        )
      }

      await exec(
        db,
        `
        UPDATE ${TORRENT_AI_METADATA_TABLE_NAME}
        SET provider = CASE
              WHEN provider IS NULL OR provider = '' THEN 'legacy'
              ELSE provider
            END,
            model = CASE
              WHEN model IS NULL OR model = '' THEN 'legacy'
              ELSE model
            END;
      `,
      )

      await exec(
        db,
        `
        CREATE INDEX IF NOT EXISTS idx_${TORRENT_AI_METADATA_TABLE_NAME}_provider
          ON ${TORRENT_AI_METADATA_TABLE_NAME} (provider);
        CREATE INDEX IF NOT EXISTS idx_${TORRENT_AI_METADATA_TABLE_NAME}_model
          ON ${TORRENT_AI_METADATA_TABLE_NAME} (model);
      `,
      )
    },
  },
]

export const runAppDatabaseMigrations = async (
  db: SqliteDatabase,
  logger: LogFunctions,
) => {
  const currentVersionRow = await get<{ user_version: number }>(
    db,
    'PRAGMA user_version',
  )

  let currentVersion = Number(currentVersionRow?.user_version ?? 0)

  for (const migration of MIGRATIONS) {
    if (currentVersion >= migration.version) {
      continue
    }

    logger.debug('Applying application database migration', {
      version: migration.version,
      name: migration.name,
      previousVersion: currentVersion,
    })

    try {
      await exec(db, 'BEGIN')
      await migration.up(db)
      await exec(db, `PRAGMA user_version = ${migration.version}`)
      await exec(db, 'COMMIT')
      currentVersion = migration.version

      logger.debug('Migration applied successfully', {
        version: migration.version,
        name: migration.name,
      })
    } catch (error) {
      await exec(db, 'ROLLBACK')
      logger.error('Failed to apply application database migration', {
        version: migration.version,
        name: migration.name,
        error,
      })
      throw error
    }
  }
}
