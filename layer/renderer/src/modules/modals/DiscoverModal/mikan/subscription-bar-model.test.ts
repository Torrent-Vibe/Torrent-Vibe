import { describe, expect, it } from 'vitest'

import type { SubscriptionTargetHealth } from '~/modules/subscriptions/selectors'

import {
  buildSubscriptionBarModel,
  formatServerNames,
  showFailedCount,
  showSubscriptionBarDetails,
} from './subscription-bar-model'

const target = (
  partial: Partial<SubscriptionTargetHealth> &
    Pick<SubscriptionTargetHealth, 'serverId'>,
): SubscriptionTargetHealth => ({
  reachable: true,
  ...partial,
})

const baseInput = {
  checkSupportByServerId: { 'srv-a': true },
  progress: { ready: 8, total: 12, failed: 1 },
  serverNames: ['NAS'],
  source: 'helper' as const,
  syncedAtIso: '2026-08-15T00:00:00.000Z',
  targets: [
    target({ serverId: 'srv-a', checkedAt: '2026-08-20T09:58:00.000Z' }),
  ],
}

describe('buildSubscriptionBarModel', () => {
  it('selects the offline variant when the source is cache, regardless of target health', () => {
    const variant = buildSubscriptionBarModel({
      ...baseInput,
      source: 'cache',
      targets: [
        target({
          serverId: 'srv-a',
          checkError: 'RSS unreachable',
          consecutiveFailures: 9,
        }),
      ],
    })
    expect(variant).toEqual({
      type: 'offline',
      serverLabel: 'NAS',
      syncedAtIso: '2026-08-15T00:00:00.000Z',
    })
  })

  it('selects the check-failed variant when any target reports a checkError', () => {
    const variant = buildSubscriptionBarModel({
      ...baseInput,
      targets: [
        target({
          serverId: 'srv-a',
          checkError: 'RSS fetch failed',
          consecutiveFailures: 4,
        }),
      ],
    })
    expect(variant).toEqual({
      type: 'check-failed',
      serverLabel: 'NAS',
      serverId: 'srv-a',
      checkError: 'RSS fetch failed',
      consecutiveFailures: 4,
    })
  })

  it('picks the target with the most consecutive failures when several are failing', () => {
    const variant = buildSubscriptionBarModel({
      ...baseInput,
      serverNames: ['NAS', 'VPS'],
      targets: [
        target({
          serverId: 'srv-a',
          checkError: 'timeout',
          consecutiveFailures: 2,
        }),
        target({
          serverId: 'srv-b',
          checkError: 'dns failure',
          consecutiveFailures: 7,
        }),
      ],
    })
    expect(variant).toMatchObject({
      type: 'check-failed',
      serverId: 'srv-b',
      checkError: 'dns failure',
      consecutiveFailures: 7,
    })
  })

  it('selects the healthy variant and carries the ready/total/failed ratio through unchanged', () => {
    const variant = buildSubscriptionBarModel(baseInput)
    expect(variant).toMatchObject({
      type: 'healthy',
      ready: 8,
      total: 12,
      failed: 1,
    })
  })

  it('reports failed as 0 so the component can suppress the failed clause', () => {
    const variant = buildSubscriptionBarModel({
      ...baseInput,
      progress: { ready: 12, total: 12, failed: 0 },
    })
    expect(variant).toMatchObject({ type: 'healthy', failed: 0 })
  })

  it('marks a subscription that has never been checked distinctly from a checked-and-healthy one', () => {
    const neverChecked = buildSubscriptionBarModel({
      ...baseInput,
      targets: [target({ serverId: 'srv-a' })],
    })
    expect(neverChecked).toMatchObject({
      type: 'healthy',
      checkedAt: { type: 'never' },
    })

    const checked = buildSubscriptionBarModel(baseInput)
    expect(checked).toMatchObject({
      type: 'healthy',
      checkedAt: {
        type: 'checked',
        checkedAtIso: '2026-08-20T09:58:00.000Z',
      },
    })
  })

  it('reports checkedAt as unsupported when no target server has the check capability', () => {
    const variant = buildSubscriptionBarModel({
      ...baseInput,
      checkSupportByServerId: { 'srv-a': false },
    })
    expect(variant).toMatchObject({
      type: 'healthy',
      checkedAt: { type: 'unsupported' },
    })
  })

  it('picks the most recent checkedAt among multiple check-capable targets', () => {
    const variant = buildSubscriptionBarModel({
      ...baseInput,
      checkSupportByServerId: { 'srv-a': true, 'srv-b': true },
      targets: [
        target({ serverId: 'srv-a', checkedAt: '2026-08-20T09:00:00.000Z' }),
        target({ serverId: 'srv-b', checkedAt: '2026-08-20T09:58:00.000Z' }),
      ],
    })
    expect(variant).toMatchObject({
      type: 'healthy',
      checkedAt: {
        type: 'checked',
        checkedAtIso: '2026-08-20T09:58:00.000Z',
      },
    })
  })
})

describe('showSubscriptionBarDetails', () => {
  it('is false whenever no onOpenLogs handler is supplied, even on a check-failed variant', () => {
    const variant = buildSubscriptionBarModel({
      ...baseInput,
      targets: [target({ serverId: 'srv-a', checkError: 'boom' })],
    })
    expect(showSubscriptionBarDetails(variant, false)).toBe(false)
  })

  it('is true only when a handler is supplied AND the variant is check-failed', () => {
    const failing = buildSubscriptionBarModel({
      ...baseInput,
      targets: [target({ serverId: 'srv-a', checkError: 'boom' })],
    })
    expect(showSubscriptionBarDetails(failing, true)).toBe(true)

    const healthy = buildSubscriptionBarModel(baseInput)
    expect(showSubscriptionBarDetails(healthy, true)).toBe(false)
  })
})

describe('formatServerNames', () => {
  it('joins multiple server names with a comma', () => {
    expect(formatServerNames(['NAS', 'VPS'])).toBe('NAS, VPS')
  })

  it('falls back to an em dash when there are no target servers', () => {
    expect(formatServerNames([])).toBe('—')
  })
})

describe('showFailedCount', () => {
  it('is false when the healthy variant has zero failures', () => {
    const variant = buildSubscriptionBarModel({
      ...baseInput,
      progress: { ready: 12, total: 12, failed: 0 },
    })
    expect(showFailedCount(variant)).toBe(false)
  })

  it('is true when the healthy variant has at least one failure', () => {
    const variant = buildSubscriptionBarModel({
      ...baseInput,
      progress: { ready: 11, total: 12, failed: 1 },
    })
    expect(showFailedCount(variant)).toBe(true)
  })

  it('is false on non-healthy variants regardless of any failure count', () => {
    const checkFailed = buildSubscriptionBarModel({
      ...baseInput,
      targets: [target({ serverId: 'srv-a', checkError: 'boom' })],
    })
    expect(showFailedCount(checkFailed)).toBe(false)

    const offline = buildSubscriptionBarModel({ ...baseInput, source: 'cache' })
    expect(showFailedCount(offline)).toBe(false)
  })
})
