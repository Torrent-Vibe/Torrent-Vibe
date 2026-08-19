import type { SubscriptionRecord } from '@torrent-vibe/helper-protocol'
import type { RssEpisode } from '@torrent-vibe/mikan'

import type { HelperStatusResponse } from '../helper-client'
import {
  clearHelperBinding,
  isHelperAuthError,
  listServerHelperTargets,
  resolveCurrentServerId,
} from '../helper-client'
import {
  liveBackfill,
  liveHelperClient,
  liveRetry,
  liveUnpair,
} from './live-client'
import type { SubscriptionPersist } from './persist'
import { localSubscriptionPersist } from './persist'
import type { HelperSyncClient } from './server-sync'
import { createServerSync } from './server-sync'
import { subscriptionKey, subscriptionStore } from './store'
import {
  dropLeftoverTorrents,
  liveDeleteTorrents,
  liveLoadHelperStatus,
} from './unsubscribe-cleanup'

export type { HelperSyncClient, SubscriptionPushOptions } from './server-sync'

export interface ActionResult<T = void> {
  data?: T
  error?: string
  ok: boolean
  warning?: string
}

export interface SubscribeInput {
  bangumiId: string
  bangumiSubjectId?: string
  coverUrl?: string
  episodes?: RssEpisode[]
  rssUrl: string
  subgroupId: string
  subgroupName: string
  targetServerIds: string[]
  title: string
}

export interface SubscriptionActionDeps {
  backfill?: (input: {
    bangumiId: string
    episodes: RssEpisode[]
    serverId: string
    subgroupId: string
  }) => Promise<void>
  deleteTorrents?: (input: {
    deleteFiles: boolean
    hashes: string[]
    serverId: string
  }) => Promise<void>
  helper: HelperSyncClient
  id?: () => string
  loadHelperStatus?: (serverId: string) => Promise<HelperStatusResponse | null>
  now?: () => string
  persist: SubscriptionPersist
  retry?: (input: {
    serverId: string
    bangumiId: string
    subgroupId: string
    episodeId: string
    title?: string
    torrentUrl?: string
  }) => Promise<void>
  unpair?: (serverId: string) => Promise<void>
}

const unique = (ids: string[]) => [...new Set(ids.filter(Boolean))]

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const writeItems = (
  persist: SubscriptionPersist,
  items: SubscriptionRecord[],
) => {
  persist.save({ items })
  subscriptionStore.setState((draft) => {
    draft.items = items
  })
}

export const createSubscriptionActions = (deps: SubscriptionActionDeps) => {
  const now = deps.now ?? (() => new Date().toISOString())
  const nextId =
    deps.id ??
    (() =>
      globalThis.crypto?.randomUUID?.() ??
      `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)

  const persistItems = (items: SubscriptionRecord[]) => {
    writeItems(deps.persist, items)
  }

  const clearOptimistic = (key: string) => {
    subscriptionStore.setState((draft) => {
      delete draft.optimistic[key]
    })
  }

  const { pushServers, refreshStatus } = createServerSync({
    helper: deps.helper,
    loadStatus: deps.loadHelperStatus ?? liveLoadHelperStatus,
    now,
    persistItems,
  })

  const hydrate = () => {
    const loaded = deps.persist.load()
    subscriptionStore.setState((draft) => {
      draft.items = loaded.items
    })
  }

  const subscribe = async (
    input: SubscribeInput,
  ): Promise<ActionResult<SubscriptionRecord>> => {
    const targetServerIds = unique(input.targetServerIds)
    if (targetServerIds.length === 0) {
      return { ok: false, error: 'noTargets' }
    }

    const existing = subscriptionStore
      .getState()
      .items.find(
        (item) =>
          item.bangumiId === input.bangumiId &&
          item.subgroupId === input.subgroupId,
      )
    const stamp = now()
    const nextItem: SubscriptionRecord = existing
      ? {
          ...existing,
          title: input.title,
          coverUrl: input.coverUrl ?? existing.coverUrl,
          bangumiSubjectId: input.bangumiSubjectId ?? existing.bangumiSubjectId,
          subgroupName: input.subgroupName,
          rssUrl: input.rssUrl,
          targetServerIds,
          updatedAt: stamp,
        }
      : {
          id: nextId(),
          providerId: 'mikan',
          bangumiId: input.bangumiId,
          title: input.title,
          coverUrl: input.coverUrl,
          bangumiSubjectId: input.bangumiSubjectId,
          subgroupId: input.subgroupId,
          subgroupName: input.subgroupName,
          rssUrl: input.rssUrl,
          targetServerIds,
          syncByServer: Object.fromEntries(
            targetServerIds.map((id) => [id, { status: 'pending' as const }]),
          ),
          createdAt: stamp,
          updatedAt: stamp,
        }

    const previousTargets = existing?.targetServerIds ?? []
    const key = subscriptionKey(input.bangumiId, input.subgroupId)
    const episodes = input.episodes ?? []
    subscriptionStore.setState((draft) => {
      draft.optimistic[key] = {
        type: 'subscribe',
        record: nextItem,
        startedAt: stamp,
        ...(episodes.length > 0
          ? { episodeIds: episodes.map((entry) => entry.episodeId) }
          : {}),
      }
    })
    persistItems(
      existing
        ? subscriptionStore
            .getState()
            .items.map((item) => (item.id === existing.id ? nextItem : item))
        : [...subscriptionStore.getState().items, nextItem],
    )

    const savedItem = () =>
      subscriptionStore.getState().items.find((item) => item.id === nextItem.id)

    const { failed, pushed } = await pushServers([
      ...previousTargets,
      ...targetServerIds,
    ])
    const importTargets = targetServerIds.filter((serverId) =>
      pushed.includes(serverId),
    )
    if (importTargets.length === 0) {
      clearOptimistic(key)
      return { ok: false, error: 'partialSync', data: savedItem() ?? nextItem }
    }

    const imported =
      episodes.length > 0
        ? await backfillTargets({
            bangumiId: input.bangumiId,
            subgroupId: input.subgroupId,
            episodes,
            serverIds: importTargets,
          })
        : { ok: true }
    await refreshStatus([...previousTargets, ...targetServerIds])
    clearOptimistic(key)

    const settled: ActionResult<SubscriptionRecord> =
      failed.length > 0
        ? { ok: false, error: 'partialSync', data: savedItem() ?? nextItem }
        : { ok: true, data: savedItem() ?? nextItem }
    return imported.ok ? settled : { ...settled, warning: 'backfillFailed' }
  }

  const unsubscribe = async (
    id: string,
    options?: { deleteFiles?: boolean },
  ): Promise<ActionResult> => {
    const current = subscriptionStore
      .getState()
      .items.find((item) => item.id === id)
    if (!current) {
      return { ok: false, error: 'notFound' }
    }
    const key = subscriptionKey(current.bangumiId, current.subgroupId)
    subscriptionStore.setState((draft) => {
      draft.optimistic[key] = { type: 'unsubscribe', startedAt: now() }
    })
    persistItems(
      subscriptionStore.getState().items.filter((item) => item.id !== id),
    )
    const deleteFiles = options?.deleteFiles === true
    let ok =
      (
        await pushServers(current.targetServerIds, {
          removeTorrents: true,
          deleteFiles,
        })
      ).failed.length === 0
    if (deps.loadHelperStatus && deps.deleteTorrents) {
      const leftoverOk = await dropLeftoverTorrents({
        serverIds: current.targetServerIds,
        bangumiId: current.bangumiId,
        subgroupId: current.subgroupId,
        deleteFiles,
        loadHelperStatus: deps.loadHelperStatus,
        deleteTorrents: deps.deleteTorrents,
      })
      if (!leftoverOk) {
        ok = false
      }
    }
    await refreshStatus(current.targetServerIds)
    clearOptimistic(key)
    return ok ? { ok: true } : { ok: false, error: 'partialSync' }
  }

  const retarget = async (
    id: string,
    targetServerIds: string[],
  ): Promise<ActionResult<SubscriptionRecord>> => {
    const nextTargets = unique(targetServerIds)
    const current = subscriptionStore
      .getState()
      .items.find((item) => item.id === id)
    if (!current) {
      return { ok: false, error: 'notFound' }
    }
    if (nextTargets.length === 0) {
      const removed = await unsubscribe(id)
      return removed.ok ? { ok: true } : { ok: false, error: removed.error }
    }
    const stamp = now()
    const nextItem: SubscriptionRecord = {
      ...current,
      targetServerIds: nextTargets,
      updatedAt: stamp,
    }
    persistItems(
      subscriptionStore
        .getState()
        .items.map((item) => (item.id === id ? nextItem : item)),
    )
    const ok =
      (await pushServers([...current.targetServerIds, ...nextTargets])).failed
        .length === 0
    const saved = subscriptionStore
      .getState()
      .items.find((item) => item.id === id)
    return ok
      ? { ok: true, data: saved ?? nextItem }
      : { ok: false, error: 'partialSync', data: saved ?? nextItem }
  }

  const syncServers = async (serverIds: string[]): Promise<ActionResult> => {
    const { failed } = await pushServers(serverIds)
    return failed.length === 0
      ? { ok: true }
      : { ok: false, error: 'partialSync' }
  }

  const syncAll = async (): Promise<ActionResult> => {
    const paired = listServerHelperTargets()
      .filter((target) => target.paired)
      .map((target) => target.id)
    const targeted = subscriptionStore
      .getState()
      .items.flatMap((item) => item.targetServerIds)
    return syncServers([...paired, ...targeted])
  }

  const findByBangumiSubgroup = (bangumiId: string, subgroupId: string) =>
    subscriptionStore
      .getState()
      .items.find(
        (item) =>
          item.bangumiId === bangumiId && item.subgroupId === subgroupId,
      ) ?? null

  const backfillTargets = async (input: {
    bangumiId: string
    episodes: RssEpisode[]
    serverIds: string[]
    subgroupId: string
  }): Promise<ActionResult> => {
    if (!deps.backfill) {
      return { ok: false, error: 'noHelper' }
    }
    let failure: string | undefined
    for (const serverId of input.serverIds) {
      try {
        await deps.backfill({
          serverId,
          bangumiId: input.bangumiId,
          subgroupId: input.subgroupId,
          episodes: input.episodes,
        })
      } catch (error) {
        if (isHelperAuthError(error)) {
          clearHelperBinding(serverId)
        }
        failure ??= errorMessage(error)
      }
    }
    return failure === undefined ? { ok: true } : { ok: false, error: failure }
  }

  const backfill = async (input: {
    bangumiId: string
    subgroupId: string
    episodes: RssEpisode[]
    serverId?: string
  }): Promise<ActionResult> => {
    const currentId = resolveCurrentServerId()
    const serverIds = unique(
      input.serverId
        ? [input.serverId]
        : (findByBangumiSubgroup(input.bangumiId, input.subgroupId)
            ?.targetServerIds ?? (currentId ? [currentId] : [])),
    )
    if (serverIds.length === 0) {
      return { ok: false, error: 'noHelper' }
    }
    const result = await backfillTargets({
      bangumiId: input.bangumiId,
      subgroupId: input.subgroupId,
      episodes: input.episodes,
      serverIds,
    })
    await refreshStatus(serverIds)
    return result
  }

  const unbindHelper = async (serverId: string): Promise<ActionResult> => {
    let unreachable = false
    if (deps.unpair) {
      try {
        await deps.unpair(serverId)
      } catch {
        unreachable = true
      }
    }
    clearHelperBinding(serverId)
    subscriptionStore.setState((draft) => {
      delete draft.statusByServer[serverId]
    })
    return unreachable ? { ok: false, error: 'unreachable' } : { ok: true }
  }

  const retryEpisode = async (input: {
    serverId: string
    bangumiId: string
    subgroupId: string
    episodeId: string
    title?: string
    torrentUrl?: string
  }): Promise<ActionResult> => {
    if (!deps.retry) {
      return { ok: false, error: 'noHelper' }
    }
    try {
      await deps.retry(input)
      await refreshStatus([input.serverId])
      return { ok: true }
    } catch (error) {
      if (isHelperAuthError(error)) {
        clearHelperBinding(input.serverId)
      }
      return { ok: false, error: errorMessage(error) }
    }
  }

  const forgetServer = async (serverId: string): Promise<ActionResult> => {
    if (deps.unpair) {
      try {
        await deps.unpair(serverId)
      } catch {
        // Local cleanup must continue when the remote Helper is unavailable.
      }
    }
    clearHelperBinding(serverId)
    const stamp = now()
    const remaining: SubscriptionRecord[] = []
    for (const item of subscriptionStore.getState().items) {
      if (!item.targetServerIds.includes(serverId)) {
        remaining.push(item)
        continue
      }
      const nextTargets = item.targetServerIds.filter((id) => id !== serverId)
      if (nextTargets.length === 0) {
        continue
      }
      const syncByServer = { ...item.syncByServer }
      delete syncByServer[serverId]
      remaining.push({
        ...item,
        targetServerIds: nextTargets,
        syncByServer,
        updatedAt: stamp,
      })
    }
    persistItems(remaining)
    subscriptionStore.setState((draft) => {
      delete draft.statusByServer[serverId]
    })
    return { ok: true }
  }

  return {
    hydrate,
    subscribe,
    unsubscribe,
    retarget,
    syncServers,
    syncAll,
    refreshStatus,
    backfill,
    findByBangumiSubgroup,
    forgetServer,
    unbindHelper,
    retryEpisode,
  }
}

export const SubscriptionActions = {
  shared: createSubscriptionActions({
    persist: localSubscriptionPersist,
    helper: liveHelperClient,
    backfill: liveBackfill,
    unpair: liveUnpair,
    retry: liveRetry,
    loadHelperStatus: liveLoadHelperStatus,
    deleteTorrents: liveDeleteTorrents,
  }),
}
