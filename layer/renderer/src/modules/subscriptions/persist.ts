import type { SubscriptionRecord } from '@torrent-vibe/helper-protocol'
import { z } from 'zod'

import { storage, STORAGE_KEYS } from '~/lib/storage-keys'

export interface PersistedSubscriptions {
  items: SubscriptionRecord[]
}

const syncEntrySchema = z.object({
  lastError: z.string().optional(),
  lastPushedAt: z.string().optional(),
  status: z.enum(['ok', 'pending', 'error']),
})

const subscriptionRecordSchema = z.object({
  bangumiId: z.string(),
  bangumiSubjectId: z.string().optional(),
  coverUrl: z.string().optional(),
  createdAt: z.string(),
  id: z.string(),
  providerId: z.literal('mikan'),
  rssUrl: z.string(),
  subgroupId: z.string(),
  subgroupName: z.string(),
  syncByServer: z
    .record(z.string(), z.unknown())
    .catch({})
    .transform((record) => {
      const next: SubscriptionRecord['syncByServer'] = {}
      for (const [serverId, entry] of Object.entries(record)) {
        const parsed = syncEntrySchema.safeParse(entry)
        if (parsed.success) {
          next[serverId] = parsed.data
        }
      }
      return next
    }),
  targetServerIds: z
    .array(z.unknown())
    .transform((ids) =>
      ids.filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  title: z.string(),
  updatedAt: z.string(),
})

const persistedSubscriptionsSchema = z.object({
  items: z.array(z.unknown()).transform((items) =>
    items.flatMap((item) => {
      const parsed = subscriptionRecordSchema.safeParse(item)
      return parsed.success ? [parsed.data] : []
    }),
  ),
})

export const emptySubscriptions = (): PersistedSubscriptions => ({
  items: [],
})

export const loadSubscriptions = (): PersistedSubscriptions => {
  const parsed = persistedSubscriptionsSchema.safeParse(
    storage.getJSON<unknown>(STORAGE_KEYS.SUBSCRIPTIONS),
  )
  return parsed.success ? parsed.data : emptySubscriptions()
}

export const saveSubscriptions = (data: PersistedSubscriptions): void => {
  storage.setJSON(STORAGE_KEYS.SUBSCRIPTIONS, {
    items: data.items,
  })
}

export interface SubscriptionPersist {
  load: () => PersistedSubscriptions
  save: (data: PersistedSubscriptions) => void
}

export const localSubscriptionPersist: SubscriptionPersist = {
  load: loadSubscriptions,
  save: saveSubscriptions,
}
