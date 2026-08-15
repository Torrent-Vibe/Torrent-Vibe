import type { SubscriptionRecord } from '@torrent-vibe/helper-protocol'

import { storage, STORAGE_KEYS } from '~/lib/storage-keys'

export interface PersistedSubscriptions {
  items: SubscriptionRecord[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

const isSyncStatus = (
  value: unknown,
): value is SubscriptionRecord['syncByServer'][string]['status'] =>
  value === 'ok' || value === 'pending' || value === 'error'

const parseSyncByServer = (
  value: unknown,
): SubscriptionRecord['syncByServer'] => {
  if (!isRecord(value)) {
    return {}
  }
  const next: SubscriptionRecord['syncByServer'] = {}
  for (const [serverId, entry] of Object.entries(value)) {
    if (!isRecord(entry) || !isSyncStatus(entry.status)) {
      continue
    }
    const parsed: SubscriptionRecord['syncByServer'][string] = {
      status: entry.status,
    }
    if (typeof entry.lastError === 'string') {
      parsed.lastError = entry.lastError
    }
    if (typeof entry.lastPushedAt === 'string') {
      parsed.lastPushedAt = entry.lastPushedAt
    }
    next[serverId] = parsed
  }
  return next
}

const parseItem = (value: unknown): SubscriptionRecord | null => {
  if (!isRecord(value)) {
    return null
  }
  if (
    typeof value.id !== 'string'
    || value.providerId !== 'mikan'
    || typeof value.bangumiId !== 'string'
    || typeof value.title !== 'string'
    || typeof value.subgroupId !== 'string'
    || typeof value.subgroupName !== 'string'
    || typeof value.rssUrl !== 'string'
    || !Array.isArray(value.targetServerIds)
    || typeof value.createdAt !== 'string'
    || typeof value.updatedAt !== 'string'
  ) {
    return null
  }
  const targetServerIds = value.targetServerIds.filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  )
  const item: SubscriptionRecord = {
    id: value.id,
    providerId: 'mikan',
    bangumiId: value.bangumiId,
    title: value.title,
    subgroupId: value.subgroupId,
    subgroupName: value.subgroupName,
    rssUrl: value.rssUrl,
    targetServerIds,
    syncByServer: parseSyncByServer(value.syncByServer),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
  if (typeof value.coverUrl === 'string') {
    item.coverUrl = value.coverUrl
  }
  if (typeof value.bangumiSubjectId === 'string') {
    item.bangumiSubjectId = value.bangumiSubjectId
  }
  return item
}

export const emptySubscriptions = (): PersistedSubscriptions => ({
  items: [],
})

export const loadSubscriptions = (): PersistedSubscriptions => {
  const stored = storage.getJSON<unknown>(STORAGE_KEYS.SUBSCRIPTIONS)
  if (!isRecord(stored) || !Array.isArray(stored.items)) {
    return emptySubscriptions()
  }
  return {
    items: stored.items
      .map(parseItem)
      .filter((item): item is SubscriptionRecord => item !== null),
  }
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
