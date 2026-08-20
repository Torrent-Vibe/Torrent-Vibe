import type { HelperEpisodeState } from '@torrent-vibe/helper-protocol'

import { SubscriptionActions } from './actions'
import type { SubscriptionsState } from './store'
import { subscriptionStore } from './store'

export const ACTIVE_POLL_INTERVAL_MS = 5000
export const SETTLED_POLL_INTERVAL_MS = 30000

const ACTIVE_EPISODE_STATES: ReadonlySet<HelperEpisodeState> = new Set([
  'pending',
  'added',
  'downloading',
  'renaming',
])

export const pollingIntervalFor = (
  episodeStates: HelperEpisodeState[],
): number =>
  episodeStates.some((state) => ACTIVE_EPISODE_STATES.has(state))
    ? ACTIVE_POLL_INTERVAL_MS
    : SETTLED_POLL_INTERVAL_MS

const trackedEpisodeStates = (
  state: SubscriptionsState,
): HelperEpisodeState[] => {
  const states: HelperEpisodeState[] = []
  for (const snapshot of Object.values(state.statusByServer)) {
    for (const job of snapshot.jobs) {
      for (const episode of job.episodes) {
        states.push(episode.state)
      }
    }
    for (const replica of snapshot.replicas) {
      for (const episode of replica.episodes) {
        states.push(episode.state)
      }
    }
  }
  return states
}

const defaultIsVisible = () =>
  typeof document === 'undefined' || document.visibilityState === 'visible'

const defaultOnVisibilityChange = (handler: () => void): (() => void) => {
  if (typeof document === 'undefined') {
    return () => {}
  }
  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}

export interface SubscriptionPollingDeps {
  isVisible?: () => boolean
  onVisibilityChange?: (handler: () => void) => () => void
  refreshStatus: (serverIds?: string[], signal?: AbortSignal) => Promise<void>
}

export interface SubscriptionPollingController {
  start: () => void
  stop: () => void
}

export const createSubscriptionPolling = (
  deps: SubscriptionPollingDeps,
): SubscriptionPollingController => {
  const isVisible = deps.isVisible ?? defaultIsVisible
  const onVisibilityChange =
    deps.onVisibilityChange ?? defaultOnVisibilityChange

  let running = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false
  let abortController: AbortController | null = null
  let unsubscribeVisibility: (() => void) | null = null

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const scheduleNext = () => {
    clearTimer()
    if (!running || !isVisible()) {
      return
    }
    const interval = pollingIntervalFor(
      trackedEpisodeStates(subscriptionStore.getState()),
    )
    timer = setTimeout(tick, interval)
  }

  function tick() {
    timer = null
    if (!running || !isVisible()) {
      return
    }
    scheduleNext()
    if (inFlight) {
      return
    }
    inFlight = true
    const controller = new AbortController()
    abortController = controller
    deps
      .refreshStatus(undefined, controller.signal)
      .catch(() => {})
      .finally(() => {
        inFlight = false
        if (abortController === controller) {
          abortController = null
        }
      })
  }

  const handleVisibilityChange = () => {
    if (!running) {
      return
    }
    if (isVisible()) {
      tick()
    } else {
      clearTimer()
    }
  }

  const start = () => {
    if (running) {
      return
    }
    running = true
    unsubscribeVisibility = onVisibilityChange(handleVisibilityChange)
    scheduleNext()
  }

  const stop = () => {
    if (!running) {
      return
    }
    running = false
    clearTimer()
    unsubscribeVisibility?.()
    unsubscribeVisibility = null
    abortController?.abort()
    abortController = null
  }

  return { start, stop }
}

export const subscriptionPolling = createSubscriptionPolling({
  refreshStatus: (serverIds, signal) =>
    SubscriptionActions.shared.refreshStatus(serverIds, signal),
})

export const startSubscriptionPolling = () => subscriptionPolling.start()
export const stopSubscriptionPolling = () => subscriptionPolling.stop()
