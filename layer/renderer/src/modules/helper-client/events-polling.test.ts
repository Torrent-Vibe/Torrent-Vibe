import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createHelperEventsPolling,
  HELPER_EVENTS_POLL_INTERVAL_MS,
} from './events-polling'
import type { HelperEventsResponse } from './types'

const page = (cursor: number): HelperEventsResponse => ({ events: [], cursor })

describe('createHelperEventsPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches immediately on start using the initial since cursor', async () => {
    const fetchPage = vi.fn(async (since: number) => page(since))
    const polling = createHelperEventsPolling({
      fetchPage,
      onPage: () => {},
      initialSince: 5,
    })

    polling.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchPage).toHaveBeenCalledWith(5)
    polling.stop()
  })

  it('polls again every 2000ms, using the cursor returned by the previous page', async () => {
    const fetchPage = vi.fn(async (since: number) => page(since + 1))
    const polling = createHelperEventsPolling({ fetchPage, onPage: () => {} })

    polling.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0)

    await vi.advanceTimersByTimeAsync(HELPER_EVENTS_POLL_INTERVAL_MS)
    expect(fetchPage).toHaveBeenNthCalledWith(2, 1)

    await vi.advanceTimersByTimeAsync(HELPER_EVENTS_POLL_INTERVAL_MS)
    expect(fetchPage).toHaveBeenNthCalledWith(3, 2)

    polling.stop()
  })

  it('calls onPage with each fetched page', async () => {
    const fetchPage = vi.fn(async () => page(3))
    const onPage = vi.fn()
    const polling = createHelperEventsPolling({ fetchPage, onPage })

    polling.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(onPage).toHaveBeenCalledWith(page(3))
    polling.stop()
  })

  it('stop leaves no pending timer: no further fetches happen after stop', async () => {
    const fetchPage = vi.fn(async (since: number) => page(since))
    const polling = createHelperEventsPolling({ fetchPage, onPage: () => {} })

    polling.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchPage).toHaveBeenCalledTimes(1)

    polling.stop()
    await vi.advanceTimersByTimeAsync(HELPER_EVENTS_POLL_INTERVAL_MS * 5)
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('does not deliver a page or schedule again if stop is called while a fetch is in flight', async () => {
    let resolveFetch: ((value: HelperEventsResponse) => void) | undefined
    const fetchPage = vi.fn(
      () =>
        new Promise<HelperEventsResponse>((resolve) => {
          resolveFetch = resolve
        }),
    )
    const onPage = vi.fn()
    const polling = createHelperEventsPolling({ fetchPage, onPage })

    polling.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchPage).toHaveBeenCalledTimes(1)

    polling.stop()
    resolveFetch?.(page(1))
    await vi.advanceTimersByTimeAsync(HELPER_EVENTS_POLL_INTERVAL_MS * 3)

    expect(onPage).not.toHaveBeenCalled()
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('reports fetch errors via onError and keeps polling on the same cursor', async () => {
    const fetchPage = vi
      .fn<(since: number) => Promise<HelperEventsResponse>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(page(1))
    const onError = vi.fn()
    const onPage = vi.fn()
    const polling = createHelperEventsPolling({ fetchPage, onPage, onError })

    polling.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(onError).toHaveBeenCalledWith(new Error('boom'))
    expect(onPage).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(HELPER_EVENTS_POLL_INTERVAL_MS)
    expect(fetchPage).toHaveBeenNthCalledWith(2, 0)
    expect(onPage).toHaveBeenCalledWith(page(1))

    polling.stop()
  })

  it('does not start a second concurrent run when start is called twice', async () => {
    const fetchPage = vi.fn(async (since: number) => page(since))
    const polling = createHelperEventsPolling({ fetchPage, onPage: () => {} })

    polling.start()
    polling.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchPage).toHaveBeenCalledTimes(1)
    polling.stop()
  })
})
