import { beforeEach, describe, expect, it } from 'vitest'

import { helperCapabilities } from '../helper-client'
import {
  capabilitiesForServer,
  ensureServerCapabilities,
} from './capability-cache'
import { subscriptionStore } from './store'

describe('ensureServerCapabilities', () => {
  beforeEach(() => {
    subscriptionStore.reset()
  })

  it('fetches each server at most once per session and caches the result', async () => {
    const calls: string[] = []
    const discover = async (serverId: string) => {
      calls.push(serverId)
      return ['profile-sync-v1', 'events', 'logs', 'check']
    }

    await ensureServerCapabilities(['srv-a', 'srv-b'], discover)
    await ensureServerCapabilities(['srv-a', 'srv-b'], discover)

    expect(calls).toEqual(['srv-a', 'srv-b'])
    expect(
      helperCapabilities(
        subscriptionStore.getState().capabilitiesByServer['srv-a'],
      ),
    ).toEqual({ events: true, logs: true, check: true })
  })

  it('degrades to all-absent capabilities when discover fails, without throwing', async () => {
    const discover = async () => {
      throw new Error('network down')
    }

    await expect(
      ensureServerCapabilities(['srv-a'], discover),
    ).resolves.toBeUndefined()
    expect(
      capabilitiesForServer('srv-a', subscriptionStore.getState()),
    ).toEqual({ events: false, logs: false, check: false })
  })

  it('does not retry a server whose earlier discover failed', async () => {
    let calls = 0
    const discover = async () => {
      calls++
      throw new Error('network down')
    }

    await ensureServerCapabilities(['srv-a'], discover)
    await ensureServerCapabilities(['srv-a'], discover)

    expect(calls).toBe(1)
  })
})

describe('capabilitiesForServer', () => {
  beforeEach(() => {
    subscriptionStore.reset()
  })

  it('reports all-absent for a server that was never fetched', () => {
    expect(
      capabilitiesForServer('unknown', subscriptionStore.getState()),
    ).toEqual({ events: false, logs: false, check: false })
  })
})
