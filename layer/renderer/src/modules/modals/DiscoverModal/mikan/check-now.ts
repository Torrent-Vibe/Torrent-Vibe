import type { SubscriptionTargetHealth } from '~/modules/subscriptions/selectors'

export interface CheckNowDeps {
  now?: () => number
  pollIntervalMs?: number
  refreshStatus: (serverIds: string[]) => Promise<void>
  resolveTargets: () => SubscriptionTargetHealth[]
  setChecking: (checking: boolean) => void
  startChecks: (serverIds: string[]) => Promise<void>
  timeoutMs?: number
  wait?: (ms: number) => Promise<void>
}

export const DEFAULT_CHECK_POLL_INTERVAL_MS = 1500
export const DEFAULT_CHECK_TIMEOUT_MS = 15000

const defaultWait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export const baselineCheckedAt = (
  targets: SubscriptionTargetHealth[],
): Record<string, string | undefined> =>
  Object.fromEntries(
    targets.map((target) => [target.serverId, target.checkedAt]),
  )

export const hasCheckAdvanced = (
  baseline: Record<string, string | undefined>,
  targets: SubscriptionTargetHealth[],
): boolean =>
  targets.some((target) => {
    if (target.checkedAt === undefined) {
      return false
    }
    const before = baseline[target.serverId]
    return before === undefined || target.checkedAt > before
  })

export const runCheckNow = async (
  targetServerIds: string[],
  deps: CheckNowDeps,
): Promise<void> => {
  const {
    now = Date.now,
    pollIntervalMs = DEFAULT_CHECK_POLL_INTERVAL_MS,
    refreshStatus,
    resolveTargets,
    setChecking,
    startChecks,
    timeoutMs = DEFAULT_CHECK_TIMEOUT_MS,
    wait = defaultWait,
  } = deps

  const baseline = baselineCheckedAt(resolveTargets())
  setChecking(true)
  try {
    await startChecks(targetServerIds)
    const deadline = now() + timeoutMs
    for (;;) {
      await refreshStatus(targetServerIds)
      if (hasCheckAdvanced(baseline, resolveTargets())) {
        return
      }
      if (now() >= deadline) {
        return
      }
      await wait(pollIntervalMs)
    }
  } finally {
    setChecking(false)
  }
}
