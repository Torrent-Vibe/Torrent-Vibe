import type {
  HelperReplica,
  SubscriptionRecord,
} from '@torrent-vibe/helper-protocol'
import { desiredStateDiff } from '@torrent-vibe/helper-protocol'
import type { RssEpisode } from '@torrent-vibe/mikan'

import {
  backfillHelper,
  clearHelperBinding,
  getHelperBinding,
  getHelperStatus,
  getHelperSubscriptions,
  isHelperAuthError,
  listServerHelperTargets,
  putHelperSubscriptions,
  resolveCurrentServerId,
} from '../helper-client'
import { desiredReplicasForServer } from './desired-set'
import type { SubscriptionPersist } from './persist'
import { localSubscriptionPersist } from './persist'
import { subscriptionStore } from './store'

export interface ActionResult<T = void> {
  ok: boolean
  data?: T
  error?: string
}

export interface SubscribeInput {
  bangumiId: string
  title: string
  coverUrl?: string
  bangumiSubjectId?: string
  subgroupId: string
  subgroupName: string
  rssUrl: string
  targetServerIds: string[]
}

export interface HelperSyncClient {
  getSubscriptions: (serverId: string) => Promise<HelperReplica[]>
  putSubscriptions: (
    serverId: string,
    replicas: HelperReplica[],
  ) => Promise<void>
}

export interface SubscriptionActionDeps {
  persist: SubscriptionPersist
  helper: HelperSyncClient
  now?: () => string
  id?: () => string
}

const unique = (ids: string[]) => [...new Set(ids.filter(Boolean))]

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const liveHelperClient: HelperSyncClient = {
  async getSubscriptions(serverId) {
    const binding = getHelperBinding(serverId)
    if (!binding) {
      throw new Error('unbound')
    }
    try {
      return await getHelperSubscriptions(binding.url, binding.token)
    }
    catch (error) {
      if (isHelperAuthError(error)) {
        clearHelperBinding(serverId)
      }
      throw error
    }
  },
  async putSubscriptions(serverId, replicas) {
    const binding = getHelperBinding(serverId)
    if (!binding) {
      throw new Error('unbound')
    }
    try {
      await putHelperSubscriptions(binding.url, binding.token, replicas)
    }
    catch (error) {
      if (isHelperAuthError(error)) {
        clearHelperBinding(serverId)
      }
      throw error
    }
  },
}

const writeItems = (
  persist: SubscriptionPersist,
  items: SubscriptionRecord[],
) => {
  persist.save({ items })
  subscriptionStore.setState((draft) => {
    draft.items = items
  })
}

const applySyncPatch = (
  items: SubscriptionRecord[],
  serverId: string,
  patch: SubscriptionRecord['syncByServer'][string],
  now: string,
): SubscriptionRecord[] =>
  items.map((item) => {
    if (
      !item.targetServerIds.includes(serverId)
      && !(serverId in item.syncByServer)
    ) {
      return item
    }
    return {
      ...item,
      updatedAt: now,
      syncByServer: {
        ...item.syncByServer,
        [serverId]: patch,
      },
    }
  })

export const createSubscriptionActions = (deps: SubscriptionActionDeps) => {
  const now = deps.now ?? (() => new Date().toISOString())
  const nextId
    = deps.id
      ?? (() =>
        globalThis.crypto?.randomUUID?.()
        ?? `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)

  const persistItems = (items: SubscriptionRecord[]) => {
    writeItems(deps.persist, items)
  }

  const pushServers = async (serverIds: string[]): Promise<boolean> => {
    const ids = unique(serverIds)
    if (ids.length === 0) {
      return true
    }

    subscriptionStore.setState((draft) => {
      draft.syncing = true
    })

    let allOk = true
    const pushedAt = now()
    try {
      for (const serverId of ids) {
        const desired = desiredReplicasForServer(
          subscriptionStore.getState().items,
          serverId,
        )
        try {
          const current = await deps.helper.getSubscriptions(serverId)
          const ops = desiredStateDiff(desired, current)
          if (ops.length > 0) {
            await deps.helper.putSubscriptions(serverId, desired)
          }
          persistItems(
            applySyncPatch(
              subscriptionStore.getState().items,
              serverId,
              { status: 'ok', lastPushedAt: pushedAt },
              pushedAt,
            ),
          )
        }
        catch (error) {
          allOk = false
          persistItems(
            applySyncPatch(
              subscriptionStore.getState().items,
              serverId,
              { status: 'error', lastError: errorMessage(error) },
              pushedAt,
            ),
          )
        }
      }
    }
    finally {
      subscriptionStore.setState((draft) => {
        draft.syncing = false
      })
    }

    return allOk
  }

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
      .items
      .find(
        item =>
          item.bangumiId === input.bangumiId
          && item.subgroupId === input.subgroupId,
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
            targetServerIds.map(id => [id, { status: 'pending' as const }]),
          ),
          createdAt: stamp,
          updatedAt: stamp,
        }

    const previousTargets = existing?.targetServerIds ?? []
    persistItems(
      existing
        ? subscriptionStore
            .getState()
            .items
            .map(item => (item.id === existing.id ? nextItem : item))
        : [...subscriptionStore.getState().items, nextItem],
    )

    const ok = await pushServers([...previousTargets, ...targetServerIds])
    const saved = subscriptionStore
      .getState()
      .items
      .find(item => item.id === nextItem.id)
    return ok
      ? { ok: true, data: saved ?? nextItem }
      : { ok: false, error: 'partialSync', data: saved ?? nextItem }
  }

  const unsubscribe = async (id: string): Promise<ActionResult> => {
    const current = subscriptionStore
      .getState()
      .items
      .find(item => item.id === id)
    if (!current) {
      return { ok: false, error: 'notFound' }
    }
    persistItems(
      subscriptionStore.getState().items.filter(item => item.id !== id),
    )
    const ok = await pushServers(current.targetServerIds)
    return ok ? { ok: true } : { ok: false, error: 'partialSync' }
  }

  const retarget = async (
    id: string,
    targetServerIds: string[],
  ): Promise<ActionResult<SubscriptionRecord>> => {
    const nextTargets = unique(targetServerIds)
    const current = subscriptionStore
      .getState()
      .items
      .find(item => item.id === id)
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
        .items.map(item => (item.id === id ? nextItem : item)),
    )
    const ok = await pushServers([...current.targetServerIds, ...nextTargets])
    const saved = subscriptionStore
      .getState()
      .items
      .find(item => item.id === id)
    return ok
      ? { ok: true, data: saved ?? nextItem }
      : { ok: false, error: 'partialSync', data: saved ?? nextItem }
  }

  const syncServers = async (serverIds: string[]): Promise<ActionResult> => {
    const ok = await pushServers(serverIds)
    return ok ? { ok: true } : { ok: false, error: 'partialSync' }
  }

  const syncAll = async (): Promise<ActionResult> => {
    const paired = listServerHelperTargets()
      .filter(target => target.paired)
      .map(target => target.id)
    const targeted = subscriptionStore
      .getState()
      .items
      .flatMap(item => item.targetServerIds)
    return syncServers([...paired, ...targeted])
  }

  const refreshStatus = async (serverIds?: string[]) => {
    const ids
      = serverIds
        ?? unique([
          ...listServerHelperTargets()
            .filter(target => target.paired)
            .map(target => target.id),
          ...subscriptionStore
            .getState()
            .items
            .flatMap(item => item.targetServerIds),
        ])
    const fetchedAt = now()
    await Promise.all(
      ids.map(async (serverId) => {
        const binding = getHelperBinding(serverId)
        if (!binding) {
          subscriptionStore.setState((draft) => {
            draft.statusByServer[serverId] = {
              replicas: [],
              fetchedAt,
              error: 'unbound',
            }
          })
          return
        }
        try {
          const status = await getHelperStatus(binding.url, binding.token)
          subscriptionStore.setState((draft) => {
            draft.statusByServer[serverId] = {
              replicas: status.replicas,
              fetchedAt,
            }
          })
        }
        catch (error) {
          if (isHelperAuthError(error)) {
            clearHelperBinding(serverId)
          }
          subscriptionStore.setState((draft) => {
            draft.statusByServer[serverId] = {
              replicas: draft.statusByServer[serverId]?.replicas ?? [],
              fetchedAt,
              error: errorMessage(error),
            }
          })
        }
      }),
    )
  }

  const backfill = async (input: {
    bangumiId: string
    subgroupId: string
    episodes: RssEpisode[]
    serverId?: string
  }): Promise<ActionResult> => {
    const currentId = input.serverId ?? resolveCurrentServerId()
    if (!currentId) {
      return { ok: false, error: 'noHelper' }
    }
    const binding = getHelperBinding(currentId)
    if (!binding) {
      return { ok: false, error: 'noHelper' }
    }
    try {
      await backfillHelper(binding.url, binding.token, {
        bangumiId: input.bangumiId,
        subgroupId: input.subgroupId,
        episodes: input.episodes,
      })
      await refreshStatus([currentId])
      return { ok: true }
    }
    catch (error) {
      if (isHelperAuthError(error)) {
        clearHelperBinding(currentId)
      }
      return { ok: false, error: errorMessage(error) }
    }
  }

  const findByBangumiSubgroup = (bangumiId: string, subgroupId: string) =>
    subscriptionStore
      .getState()
      .items
      .find(
        item =>
          item.bangumiId === bangumiId && item.subgroupId === subgroupId,
      ) ?? null

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
  }
}

export const SubscriptionActions = {
  shared: createSubscriptionActions({
    persist: localSubscriptionPersist,
    helper: liveHelperClient,
  }),
}
