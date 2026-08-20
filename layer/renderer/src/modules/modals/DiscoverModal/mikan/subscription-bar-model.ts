import type {
  SubscriptionProgress,
  SubscriptionSource,
  SubscriptionTargetHealth,
} from '~/modules/subscriptions/selectors'

export type SubscriptionBarCheckState =
  | { checkedAtIso: string; type: 'checked' }
  | { type: 'never' }
  | { type: 'unsupported' }

export type SubscriptionBarVariant =
  | {
      checkedAt: SubscriptionBarCheckState
      failed: number
      ready: number
      serverNames: string[]
      total: number
      type: 'healthy'
    }
  | {
      checkError: string
      consecutiveFailures: number
      serverNames: string[]
      type: 'check-failed'
    }
  | {
      serverNames: string[]
      syncedAtIso: string
      type: 'offline'
    }

export interface SubscriptionBarModelInput {
  checkSupportByServerId: Record<string, boolean>
  progress: SubscriptionProgress
  serverNames: string[]
  source: SubscriptionSource
  syncedAtIso: string
  targets: SubscriptionTargetHealth[]
}

const worstFailingTarget = (
  targets: SubscriptionTargetHealth[],
): SubscriptionTargetHealth | null =>
  targets.reduce<SubscriptionTargetHealth | null>((worst, target) => {
    if (target.checkError === undefined) return worst
    if (!worst) return target
    return (target.consecutiveFailures ?? 1) > (worst.consecutiveFailures ?? 1)
      ? target
      : worst
  }, null)

const latestCheckedAt = (targets: SubscriptionTargetHealth[]): string | null =>
  targets.reduce<string | null>((latest, target) => {
    if (target.checkedAt === undefined) return latest
    if (!latest) return target.checkedAt
    return target.checkedAt.localeCompare(latest) > 0
      ? target.checkedAt
      : latest
  }, null)

const resolveCheckedAt = (
  targets: SubscriptionTargetHealth[],
  checkSupportByServerId: Record<string, boolean>,
): SubscriptionBarCheckState => {
  const supportingTargets = targets.filter(
    (target) => checkSupportByServerId[target.serverId],
  )
  if (supportingTargets.length === 0) {
    return { type: 'unsupported' }
  }
  const iso = latestCheckedAt(supportingTargets)
  return iso === null
    ? { type: 'never' }
    : { type: 'checked', checkedAtIso: iso }
}

export const buildSubscriptionBarModel = (
  input: SubscriptionBarModelInput,
): SubscriptionBarVariant => {
  const {
    checkSupportByServerId,
    progress,
    serverNames,
    source,
    syncedAtIso,
    targets,
  } = input

  if (source === 'cache') {
    return { type: 'offline', serverNames, syncedAtIso }
  }

  const failing = worstFailingTarget(targets)
  if (failing) {
    return {
      type: 'check-failed',
      serverNames,
      checkError: failing.checkError as string,
      consecutiveFailures: failing.consecutiveFailures ?? 1,
    }
  }

  return {
    type: 'healthy',
    serverNames,
    ready: progress.ready,
    total: progress.total,
    failed: progress.failed,
    checkedAt: resolveCheckedAt(targets, checkSupportByServerId),
  }
}

export const showSubscriptionBarDetails = (
  variant: SubscriptionBarVariant,
  hasLogHandler: boolean,
): boolean => variant.type === 'check-failed' && hasLogHandler
