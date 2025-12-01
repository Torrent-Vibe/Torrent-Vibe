import { getLogger } from '~/config/log-config'

import {
  AppDatabase,
  TORRENT_AI_METADATA_TABLE_NAME,
  TorrentAiMetadataRowSchema,
} from '../database'
import type { SqliteDatabase } from '../database/sqlite-utils'
import { exec, get, run } from '../database/sqlite-utils'
import type { TorrentAiCacheValue } from './types'

const LEGACY_VALUE = 'legacy'

const logger = getLogger('[torrent-ai-db]')

type SaveOptions = {
  limit?: number | null
}

export class TorrentAiDatabase {
  private static instance: TorrentAiDatabase | null = null

  static getInstance(): TorrentAiDatabase {
    if (!this.instance) {
      this.instance = new TorrentAiDatabase(AppDatabase.getInstance())
    }
    return this.instance
  }

  private readonly sqlite: SqliteDatabase
  private readonly ready: Promise<void>

  private constructor(appDatabase: AppDatabase) {
    this.sqlite = appDatabase.getSqlite()
    this.ready = appDatabase.waitUntilReady()
  }

  async get(key: string): Promise<TorrentAiCacheValue | undefined> {
    await this.ready

    try {
      const row = await get<{
        key: string
        metadata: string
        provider: string
        model: string
        createdAt: number
      }>(
        this.sqlite,
        `SELECT key, metadata, provider, model, created_at as createdAt
         FROM ${TORRENT_AI_METADATA_TABLE_NAME}
         WHERE key = ?
         LIMIT 1`,
        [key],
      )

      if (!row) {
        return undefined
      }

      const parsedRow = TorrentAiMetadataRowSchema.safeParse(row)
      if (!parsedRow.success) {
        logger.warn('Invalid torrent AI metadata row encountered, deleting', {
          key,
          issues: parsedRow.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        })
        await this.delete(key)
        return undefined
      }

      const { metadata, createdAt, provider, model } = parsedRow.data

      try {
        const parsedMetadata = JSON.parse(
          metadata,
        ) as TorrentAiCacheValue['metadata']

        if (!parsedMetadata.provider || parsedMetadata.provider.trim() === '') {
          parsedMetadata.provider = provider
        }

        if (!parsedMetadata.model || parsedMetadata.model.trim() === '') {
          parsedMetadata.model = model
        }

        return {
          metadata: parsedMetadata,
          createdAt,
        }
      } catch (error) {
        logger.warn(
          'Failed to parse cached torrent AI metadata, deleting entry',
          {
            key,
            error,
          },
        )
        await this.delete(key)
        return undefined
      }
    } catch (error) {
      logger.error('Failed to read torrent AI metadata from database', error)
      return undefined
    }
  }

  async set(
    key: string,
    value: TorrentAiCacheValue,
    options?: SaveOptions,
  ): Promise<void> {
    await this.ready

    const createdAt = Number.isFinite(value.createdAt)
      ? Math.floor(value.createdAt)
      : Date.now()

    const provider = value.metadata.provider?.trim() || LEGACY_VALUE
    const model = value.metadata.model?.trim() || LEGACY_VALUE
    const metadataToStore = {
      ...value.metadata,
      provider,
      model,
    }

    try {
      await run(
        this.sqlite,
        `INSERT INTO ${TORRENT_AI_METADATA_TABLE_NAME} (
          key,
          metadata,
          provider,
          model,
          created_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          metadata = excluded.metadata,
          provider = excluded.provider,
          model = excluded.model,
          created_at = excluded.created_at`,
        [key, JSON.stringify(metadataToStore), provider, model, createdAt],
      )
    } catch (error) {
      logger.error('Failed to persist torrent AI metadata', { key, error })
      return
    }

    const limit = options?.limit
    if (limit != null && limit > 0) {
      try {
        await run(
          this.sqlite,
          `DELETE FROM ${TORRENT_AI_METADATA_TABLE_NAME}
             WHERE key IN (
               SELECT key FROM ${TORRENT_AI_METADATA_TABLE_NAME}
               ORDER BY created_at DESC
               LIMIT -1 OFFSET ?
             )`,
          [limit],
        )
      } catch (error) {
        logger.warn(
          'Failed to trim torrent AI metadata entries to limit',
          error,
        )
      }
    }
  }

  async clear(): Promise<void> {
    await this.ready

    try {
      await exec(this.sqlite, `DELETE FROM ${TORRENT_AI_METADATA_TABLE_NAME}`)
    } catch (error) {
      logger.error('Failed to clear torrent AI metadata table', error)
    }
  }

  private async delete(key: string) {
    await this.ready

    try {
      await run(
        this.sqlite,
        `DELETE FROM ${TORRENT_AI_METADATA_TABLE_NAME} WHERE key = ?`,
        [key],
      )
    } catch (error) {
      logger.error('Failed to delete torrent AI metadata entry', { key, error })
    }
  }
}
