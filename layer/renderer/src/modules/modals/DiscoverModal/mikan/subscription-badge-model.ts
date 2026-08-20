import { subscriptionFor, subscriptionProgress } from '~/modules/subscriptions'
import type { SubscriptionsState } from '~/modules/subscriptions/store'

export type SubscriptionBadgeTone = 'destructive' | 'neutral'

export interface SubscriptionBadgeModel {
  count: number
  tone: SubscriptionBadgeTone
}

const subscriptionNeedsAttention = (
  bangumiId: string,
  subgroupId: string,
  state: SubscriptionsState,
): boolean => {
  const resolved = subscriptionFor(bangumiId, subgroupId, state)
  if (!resolved) return false
  if (subscriptionProgress(resolved.record, state).failed > 0) return true
  return resolved.targets.some((target) => target.checkError !== undefined)
}

export const buildSubscriptionBadgeModel = (
  state: SubscriptionsState,
): SubscriptionBadgeModel => ({
  count: state.items.length,
  tone: state.items.some((item) =>
    subscriptionNeedsAttention(item.bangumiId, item.subgroupId, state),
  )
    ? 'destructive'
    : 'neutral',
})
