import type {
  HelperReplica,
  HelperSubscriptionSnapshot,
  SubscriptionRecord,
} from '@torrent-vibe/helper-protocol'
import { desiredStateDiff } from '@torrent-vibe/helper-protocol'

import type { HelperStatusResponse } from '../helper-client'
import { listServerHelperTargets } from '../helper-client'
import { desiredReplicasForServer, mergeDesiredReplicas } from './desired-set'
import { subscriptionStore } from './store'

export interface SubscriptionPushOptions {
  deleteFiles?: boolean
  removeTorrents?: boolean
}

export interface ServerPushResult {
  failed: string[]
  pushed: string[]
}

export interface HelperSyncClient {
  getSubscriptions: (serverId: string) => Promise<HelperSubscriptionSnapshot>
  putSubscriptions: (
    serverId: string,
    replicas: HelperReplica[],
    expectedRevision: number,
    options?: SubscriptionPushOptions,
  ) => Promise<void>
}

const MAX_PUSH_ATTEMPTS = 3

const unique = (ids: string[]) => [...new Set(ids.filter(Boolean))]

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const isRevisionConflict = (error: unknown) =>
  (error as { status?: number } | null)?.status === 409

const applySyncPatch = (
  items: SubscriptionRecord[],
  serverId: string,
  patch: SubscriptionRecord['syncByServer'][string],
  now: string,
): SubscriptionRecord[] =>
  items.map((item) => {
    if (
      !item.targetServerIds.includes(serverId) &&
      !(serverId in item.syncByServer)
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

export const createServerSync = (input: {
  helper: HelperSyncClient
  loadStatus: (
    serverId: string,
    signal?: AbortSignal,
  ) => Promise<HelperStatusResponse | null>
  now: () => string
  persistItems: (items: SubscriptionRecord[]) => void
}) => {
  const pushServer = async (
    serverId: string,
    options?: SubscriptionPushOptions,
  ) => {
    const base = await input.helper.getSubscriptions(serverId)
    let snapshot = base
    for (let attempt = 0; attempt < MAX_PUSH_ATTEMPTS; attempt++) {
      const desired = mergeDesiredReplicas({
        base: base.replicas,
        desired: desiredReplicasForServer(
          subscriptionStore.getState().items,
          serverId,
        ),
        remote: snapshot.replicas,
      })
      if (desiredStateDiff(desired, snapshot.replicas).length === 0) {
        return
      }
      try {
        await input.helper.putSubscriptions(
          serverId,
          desired,
          snapshot.revision,
          options,
        )
        return
      } catch (error) {
        if (!isRevisionConflict(error)) {
          throw error
        }
        if (attempt === MAX_PUSH_ATTEMPTS - 1) {
          throw new Error('revisionConflict', { cause: error })
        }
        snapshot = await input.helper.getSubscriptions(serverId)
      }
    }
  }

  const pushServers = async (
    serverIds: string[],
    options?: SubscriptionPushOptions,
  ): Promise<ServerPushResult> => {
    const result: ServerPushResult = { failed: [], pushed: [] }
    const ids = unique(serverIds)
    if (ids.length === 0) {
      return result
    }

    subscriptionStore.setState((draft) => {
      draft.syncing = true
    })

    const pushedAt = input.now()
    try {
      for (const serverId of ids) {
        try {
          await pushServer(serverId, options)
          result.pushed.push(serverId)
          input.persistItems(
            applySyncPatch(
              subscriptionStore.getState().items,
              serverId,
              { status: 'ok', lastPushedAt: pushedAt },
              pushedAt,
            ),
          )
        } catch (error) {
          result.failed.push(serverId)
          input.persistItems(
            applySyncPatch(
              subscriptionStore.getState().items,
              serverId,
              { status: 'error', lastError: errorMessage(error) },
              pushedAt,
            ),
          )
        }
      }
    } finally {
      subscriptionStore.setState((draft) => {
        draft.syncing = false
      })
    }

    return result
  }

  const refreshStatus = async (serverIds?: string[], signal?: AbortSignal) => {
    const ids = unique(
      serverIds ?? [
        ...listServerHelperTargets()
          .filter((target) => target.paired)
          .map((target) => target.id),
        ...subscriptionStore
          .getState()
          .items.flatMap((item) => item.targetServerIds),
      ],
    )
    const fetchedAt = input.now()
    await Promise.all(
      ids.map(async (serverId) => {
        try {
          const status = await input.loadStatus(serverId, signal)
          subscriptionStore.setState((draft) => {
            draft.statusByServer[serverId] = status
              ? { replicas: status.replicas, jobs: status.jobs, fetchedAt }
              : { replicas: [], jobs: [], fetchedAt, error: 'unbound' }
          })
        } catch (error) {
          subscriptionStore.setState((draft) => {
            draft.statusByServer[serverId] = {
              replicas: draft.statusByServer[serverId]?.replicas ?? [],
              jobs: draft.statusByServer[serverId]?.jobs ?? [],
              fetchedAt,
              error: errorMessage(error),
            }
          })
        }
      }),
    )
  }

  return { pushServers, refreshStatus }
}
