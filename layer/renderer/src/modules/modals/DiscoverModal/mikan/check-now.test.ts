import { describe, expect, it } from 'vitest'

import type { SubscriptionTargetHealth } from '~/modules/subscriptions/selectors'

import { baselineCheckedAt, hasCheckAdvanced, runCheckNow } from './check-now'

const target = (
  partial: Partial<SubscriptionTargetHealth> = {},
): SubscriptionTargetHealth => ({
  serverId: 'srv-a',
  reachable: true,
  ...partial,
})

describe('baselineCheckedAt', () => {
  it('maps each target to its checkedAt, including undefined for never-checked targets', () => {
    expect(
      baselineCheckedAt([
        target({ serverId: 'srv-a', checkedAt: '2026-08-20T00:00:00.000Z' }),
        target({ serverId: 'srv-b' }),
      ]),
    ).toEqual({
      'srv-a': '2026-08-20T00:00:00.000Z',
      'srv-b': undefined,
    })
  })
})

describe('hasCheckAdvanced', () => {
  it('is false when the target has never been checked', () => {
    expect(hasCheckAdvanced({}, [target({ checkedAt: undefined })])).toBe(false)
  })

  it('is true when a target that had no baseline now reports a checkedAt', () => {
    expect(
      hasCheckAdvanced({}, [target({ checkedAt: '2026-08-20T00:00:00.000Z' })]),
    ).toBe(true)
  })

  it('is false when checkedAt is unchanged from the baseline', () => {
    const stamp = '2026-08-20T00:00:00.000Z'
    expect(
      hasCheckAdvanced({ 'srv-a': stamp }, [target({ checkedAt: stamp })]),
    ).toBe(false)
  })

  it('is true when checkedAt is newer than the baseline', () => {
    expect(
      hasCheckAdvanced({ 'srv-a': '2026-08-20T00:00:00.000Z' }, [
        target({ checkedAt: '2026-08-20T00:00:05.000Z' }),
      ]),
    ).toBe(true)
  })

  it('is true if any one of several targets advanced', () => {
    const stamp = '2026-08-20T00:00:00.000Z'
    expect(
      hasCheckAdvanced({ 'srv-a': stamp, 'srv-b': stamp }, [
        target({ serverId: 'srv-a', checkedAt: stamp }),
        target({ serverId: 'srv-b', checkedAt: '2026-08-20T00:00:05.000Z' }),
      ]),
    ).toBe(true)
  })
})

describe('runCheckNow', () => {
  it('sets a pending state, starts the checks, and resolves once a newer checkedAt is observed', async () => {
    const checkingCalls: boolean[] = []
    let refreshCalls = 0
    let startedWith: string[] | null = null
    const checkedAtByPoll = [undefined, undefined, '2026-08-20T00:00:05.000Z']
    let poll = 0

    await runCheckNow(['srv-a'], {
      startChecks: async (serverIds) => {
        startedWith = serverIds
      },
      refreshStatus: async () => {
        refreshCalls++
      },
      resolveTargets: () => [target({ checkedAt: checkedAtByPoll[poll++] })],
      setChecking: (checking) => checkingCalls.push(checking),
      wait: async () => {},
    })

    expect(startedWith).toEqual(['srv-a'])
    expect(checkingCalls).toEqual([true, false])
    expect(refreshCalls).toBe(2)
  })

  it('gives up once the timeout elapses without a newer checkedAt, still clearing the pending state', async () => {
    const checkingCalls: boolean[] = []
    let refreshCalls = 0
    let waitCalls = 0
    let clock = 0
    const now = () => {
      clock += 5000
      return clock
    }

    await runCheckNow(['srv-a'], {
      startChecks: async () => {},
      refreshStatus: async () => {
        refreshCalls++
      },
      resolveTargets: () => [target({ checkedAt: undefined })],
      setChecking: (checking) => checkingCalls.push(checking),
      wait: async () => {
        waitCalls++
      },
      now,
      timeoutMs: 12000,
      pollIntervalMs: 1000,
    })

    expect(checkingCalls).toEqual([true, false])
    expect(refreshCalls).toBeGreaterThan(0)
    expect(refreshCalls).toBeLessThan(10)
    expect(waitCalls).toBe(refreshCalls - 1)
  })

  it('clears the pending state even when a dependency throws', async () => {
    const checkingCalls: boolean[] = []

    await expect(
      runCheckNow(['srv-a'], {
        startChecks: async () => {
          throw new Error('boom')
        },
        refreshStatus: async () => {},
        resolveTargets: () => [target({ checkedAt: undefined })],
        setChecking: (checking) => checkingCalls.push(checking),
        wait: async () => {},
      }),
    ).rejects.toThrow('boom')

    expect(checkingCalls).toEqual([true, false])
  })
})
