import type { HelperEventsResponse } from './types'

export const HELPER_EVENTS_POLL_INTERVAL_MS = 2000

export interface HelperEventsPollingDeps {
  fetchPage: (since: number) => Promise<HelperEventsResponse>
  initialSince?: number
  intervalMs?: number
  onError?: (error: unknown) => void
  onPage: (page: HelperEventsResponse) => void
}

export interface HelperEventsPollingController {
  start: () => void
  stop: () => void
}

export const createHelperEventsPolling = (
  deps: HelperEventsPollingDeps,
): HelperEventsPollingController => {
  const interval = deps.intervalMs ?? HELPER_EVENTS_POLL_INTERVAL_MS
  let since = deps.initialSince ?? 0
  let running = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const scheduleNext = () => {
    clearTimer()
    if (!running) {
      return
    }
    timer = setTimeout(tick, interval)
  }

  function tick() {
    timer = null
    if (!running || inFlight) {
      return
    }
    inFlight = true
    deps
      .fetchPage(since)
      .then((page) => {
        if (!running) {
          return
        }
        since = page.cursor
        deps.onPage(page)
      })
      .catch((error: unknown) => {
        if (!running) {
          return
        }
        deps.onError?.(error)
      })
      .finally(() => {
        inFlight = false
        scheduleNext()
      })
  }

  const start = () => {
    if (running) {
      return
    }
    running = true
    tick()
  }

  const stop = () => {
    running = false
    clearTimer()
  }

  return { start, stop }
}
