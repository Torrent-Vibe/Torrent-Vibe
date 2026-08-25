import { z } from 'zod'

import { DEFAULT_HELPER_PORT } from './types'

const compactArray = <Schema extends z.ZodType>(schema: Schema) =>
  z.array(z.unknown()).transform((items): z.output<Schema>[] =>
    items.flatMap((item) => {
      const parsed = schema.safeParse(item)
      return parsed.success ? [parsed.data] : []
    }),
  )

const compactRecord = <Schema extends z.ZodType>(schema: Schema) =>
  z
    .record(z.string(), z.unknown())
    .transform((record): Record<string, z.output<Schema>> => {
      const next: Record<string, z.output<Schema>> = {}
      for (const [key, value] of Object.entries(record)) {
        const parsed = schema.safeParse(value)
        if (parsed.success) {
          next[key] = parsed.data
        }
      }
      return next
    })

export const parseOrThrow = <T>(
  schema: z.ZodType<T>,
  value: unknown,
  message: string,
): T => {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw new Error(message)
  }
  return parsed.data
}

export const helperDiscoverSchema = z.object({
  advertisedQbitUrl: z.string().catch(''),
  bindState: z.string().catch('unbound'),
  capabilities: compactArray(z.string()).catch([]),
  clientCount: z.number().catch(0),
  port: z.number().catch(DEFAULT_HELPER_PORT),
  requiresPairingCode: z
    .unknown()
    .optional()
    .transform((value) => value !== false),
  version: z.string().catch(''),
})

const helperProfileRecordSchema = z.object({
  key: z.string(),
  secret: z.boolean().catch(false),
  updatedAt: z.string().catch(''),
  updatedBy: z.string().catch(''),
  value: z.string(),
})

export const helperProfileSnapshotSchema = z.object({
  records: compactArray(helperProfileRecordSchema),
  revision: z.number(),
})

export const helperPairResultSchema = z.object({
  clientId: z.string().optional(),
  token: z.string(),
})

const helperReplicaSchema = z.object({
  bangumiId: z.string(),
  bangumiSubjectId: z.string().optional(),
  id: z.string(),
  rssUrl: z.string(),
  subgroupId: z.string(),
  subgroupName: z.string(),
  title: z.string(),
})

export const helperSubscriptionSnapshotSchema = z.object({
  replicas: z.array(helperReplicaSchema),
  revision: z.number(),
})

const helperEpisodeStateSchema = z.enum([
  'pending',
  'added',
  'downloading',
  'renaming',
  'done',
  'failed',
  'needs-manual',
  'skipped',
])

const helperEpisodeStatusSchema = z.object({
  episode: z.number().nullable().catch(null),
  episodeId: z.string(),
  infohash: z.string().optional(),
  lastError: z.string().optional(),
  season: z.number().nullable().catch(null),
  state: helperEpisodeStateSchema.catch('pending'),
  title: z.string(),
})

const helperReplicaStatusSchema = helperReplicaSchema.extend({
  checkError: z.string().min(1).optional().catch(undefined),
  checkedAt: z.string().optional(),
  consecutiveFailures: z.number().optional(),
  episodes: compactArray(helperEpisodeStatusSchema).catch([]),
})

const helperJobStatusSchema = z.object({
  bangumiId: z.string(),
  episodes: compactArray(helperEpisodeStatusSchema).catch([]),
  subgroupId: z.string(),
})

export const helperStatusResponseSchema = z.object({
  jobs: compactArray(helperJobStatusSchema).catch([]),
  replicas: compactArray(helperReplicaStatusSchema),
})

export const helperConfigPublicSchema = z.object({
  category: z.string().catch('Bangumi'),
  hasQbitPass: z.boolean().catch(false),
  hasTmdbApiKey: z.boolean().catch(false),
  libraryRoot: z.string().catch(''),
  pollIntervalMs: z.number().catch(600_000),
  proxyUrl: z.string().catch(''),
  qbitUrl: z.string().catch(''),
  qbitUser: z.string().catch(''),
  variantPrefer: z.string().min(1).catch('internal,sc,tc'),
})

export const helperBindingSchema = z
  .object({
    clientId: z.string().trim().min(1).optional().catch(undefined),
    token: z.string().refine((value) => value.trim().length > 0),
    url: z.string().trim().min(1),
  })
  .transform((value) => ({
    clientId: value.clientId ?? 'legacy-desktop',
    token: value.token,
    url: value.url,
  }))

export const helperBindingsSchema = compactRecord(helperBindingSchema).catch({})

const helperEventSchema = z.object({
  at: z.string(),
  bangumiId: z.string().optional(),
  episodeId: z.string().optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
  kind: z.string(),
  level: z.string(),
  message: z.string(),
  replicaId: z.string().optional(),
  seq: z.number(),
  subgroupId: z.string().optional(),
})

export const helperEventsResponseSchema = z.object({
  cursor: z.number().catch(0),
  events: compactArray(helperEventSchema),
})
