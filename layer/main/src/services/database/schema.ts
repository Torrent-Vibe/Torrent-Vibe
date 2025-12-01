import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { z } from 'zod'

export const TORRENT_AI_METADATA_TABLE_NAME = 'torrent_ai_metadata'

export const torrentAiMetadataTable = sqliteTable(
  TORRENT_AI_METADATA_TABLE_NAME,
  {
    key: text('key').primaryKey(),
    metadata: text('metadata').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    createdAtIdx: index('idx_torrent_ai_metadata_created_at').on(
      table.createdAt,
    ),
    providerIdx: index('idx_torrent_ai_metadata_provider').on(table.provider),
    modelIdx: index('idx_torrent_ai_metadata_model').on(table.model),
  }),
)

export const TorrentAiMetadataRowSchema = z.object({
  key: z.string().min(1),
  metadata: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  createdAt: z.number().int(),
})

export type TorrentAiMetadataRow = z.infer<typeof TorrentAiMetadataRowSchema>

export const appDatabaseSchema = {
  torrentAiMetadata: torrentAiMetadataTable,
}

export type AppDatabaseSchema = typeof appDatabaseSchema
