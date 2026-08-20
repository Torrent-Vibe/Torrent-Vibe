import type { HelperEpisodeState } from '@torrent-vibe/helper-protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSubscriptionPolling, pollingIntervalFor } from './polling'
import type { HelperStatusSnapshot } from './store'
import { subscriptionStore } from './store'

const snapshotWithEpisodeState = (
  state: HelperEpisodeState,
): HelperStatusSnapshot => ({
  fetchedAt: '2026-08-20T00:00:00.000Z',
  jobs: [
    {
      bangumiId: 'bgm-1',
      subgroupId: 'sg-1',
      episodes: [
        {
          episodeId: 'e1',
          title: 'E1',
          season: 1,
          episode: 1,
          state,
        },
      ],
    },
  ],
  replicas: [],
})

const activeSnapshot = (): HelperStatusSnapshot =>
  snapshotWithEpisodeState('downloading')

const seedActiveEpisode = () => {
  subscriptionStore.setState((draft) => {
    draft.statusByServer['srv-a'] = activeSnapshot()
  })
}

const seedEpisodeState = (state: HelperEpisodeState) => {
  subscriptionStore.setState((draft) => {
    draft.statusByServer['srv-a'] = snapshotWithEpisodeState(state)
  })
}

describe('pollingIntervalFor', () => {
  it('returns the active 5000ms interval when any tracked episode is unsettled', () => {
    expect(pollingIntervalFor(['pending'])).toBe(5000)
    expect(pollingIntervalFor(['added'])).toBe(5000)
    expect(pollingIntervalFor(['downloading'])).toBe(5000)
    expect(pollingIntervalFor(['renaming'])).toBe(5000)
    expect(pollingIntervalFor(['done', 'downloading'])).toBe(5000)
  })

  it('returns the settled 30000ms interval when every tracked episode has settled', () => {
    expect(
      pollingIntervalFor(['done', 'skipped', 'failed', 'needs-manual']),
    ).toBe(30000)
    expect(pollingIntervalFor(['done'])).toBe(30000)
    expect(pollingIntervalFor([])).toBe(30000)
  })
})

describe('createSubscriptionPolling', () => {
  beforeEach(() => {
    subscriptionStore.reset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ticks refreshStatus on the active interval while episodes are unsettled', async () => {
    seedActiveEpisode()
    const refreshStatus = vi.fn(async () => {})
    const polling = createSubscriptionPolling({
      refreshStatus,
      isVisible: () => true,
      onVisibilityChange: () => () => {},
    })

    polling.start()
    expect(refreshStatus).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(5000)
    expect(refreshStatus).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5000)
    expect(refreshStatus).toHaveBeenCalledTimes(2)

    polling.stop()
  })

  it('drops an overlapping tick instead of queueing it', async () => {
    seedActiveEpisode()
    let resolveFirst: (() => void) | undefined
    const refreshStatus = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve
        }),
    )
    const polling = createSubscriptionPolling({
      refreshStatus,
      isVisible: () => true,
      onVisibilityChange: () => () => {},
    })

    polling.start()
    await vi.advanceTimersByTimeAsync(5000)
    expect(refreshStatus).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5000)
    expect(refreshStatus).toHaveBeenCalledTimes(1)

    resolveFirst?.()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(refreshStatus).toHaveBeenCalledTimes(2)

    polling.stop()
  })

  it('stops ticking while hidden and restarts immediately once visible again', async () => {
    seedActiveEpisode()
    let visible = true
    let handler: (() => void) | undefined
    const refreshStatus = vi.fn(async () => {})
    const polling = createSubscriptionPolling({
      refreshStatus,
      isVisible: () => visible,
      onVisibilityChange: (nextHandler) => {
        handler = nextHandler
        return () => {
          handler = undefined
        }
      },
    })

    polling.start()
    await vi.advanceTimersByTimeAsync(5000)
    expect(refreshStatus).toHaveBeenCalledTimes(1)

    visible = false
    handler?.()
    await vi.advanceTimersByTimeAsync(60000)
    expect(refreshStatus).toHaveBeenCalledTimes(1)

    visible = true
    handler?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(refreshStatus).toHaveBeenCalledTimes(2)

    polling.stop()
  })

  it('stop leaves no pending timer, unsubscribes visibility, and aborts the in-flight request', async () => {
    seedActiveEpisode()
    let capturedSignal: AbortSignal | undefined
    let resolveRefresh: (() => void) | undefined
    const refreshStatus = vi.fn(
      (_serverIds?: string[], signal?: AbortSignal) => {
        capturedSignal = signal
        return new Promise<void>((resolve) => {
          resolveRefresh = resolve
        })
      },
    )
    let unsubscribed = false
    const polling = createSubscriptionPolling({
      refreshStatus,
      isVisible: () => true,
      onVisibilityChange: () => () => {
        unsubscribed = true
      },
    })

    polling.start()
    await vi.advanceTimersByTimeAsync(5000)
    expect(refreshStatus).toHaveBeenCalledTimes(1)
    expect(capturedSignal?.aborted).toBe(false)

    polling.stop()
    expect(capturedSignal?.aborted).toBe(true)
    expect(unsubscribed).toBe(true)

    const callsAtStop = refreshStatus.mock.calls.length
    await vi.advanceTimersByTimeAsync(120000)
    expect(refreshStatus).toHaveBeenCalledTimes(callsAtStop)

    resolveRefresh?.()
  })

  it('lengthens the next scheduled delay to 30000ms once episodes settle mid-session', async () => {
    seedEpisodeState('downloading')
    const refreshStatus = vi.fn(async () => {})
    const polling = createSubscriptionPolling({
      refreshStatus,
      isVisible: () => true,
      onVisibilityChange: () => () => {},
    })

    polling.start()
    await vi.advanceTimersByTimeAsync(5000)
    expect(refreshStatus).toHaveBeenCalledTimes(1)

    seedEpisodeState('done')
    await vi.advanceTimersByTimeAsync(5000)
    expect(refreshStatus).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(29999)
    expect(refreshStatus).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1)
    expect(refreshStatus).toHaveBeenCalledTimes(3)

    polling.stop()
  })

  it('shortens the next scheduled delay to 5000ms once an episode goes active mid-session', async () => {
    seedEpisodeState('done')
    const refreshStatus = vi.fn(async () => {})
    const polling = createSubscriptionPolling({
      refreshStatus,
      isVisible: () => true,
      onVisibilityChange: () => () => {},
    })

    polling.start()
    await vi.advanceTimersByTimeAsync(30000)
    expect(refreshStatus).toHaveBeenCalledTimes(1)

    seedEpisodeState('downloading')
    await vi.advanceTimersByTimeAsync(30000)
    expect(refreshStatus).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(4999)
    expect(refreshStatus).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1)
    expect(refreshStatus).toHaveBeenCalledTimes(3)

    polling.stop()
  })
})
