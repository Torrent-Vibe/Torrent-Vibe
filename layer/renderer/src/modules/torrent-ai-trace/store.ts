import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createWithEqualityFn } from 'zustand/traditional'

import type { TorrentAiTraceState } from './types'

const createInitialState = (): TorrentAiTraceState => ({
  selectedRunId: null,
  runs: {},
  runOrder: [],
})

export const useTorrentAiTraceStore
  = createWithEqualityFn<TorrentAiTraceState>()(
    subscribeWithSelector(immer(createInitialState)),
  )

export const torrentAiTraceStore = {
  getState: () => useTorrentAiTraceStore.getState(),
  setState: (
    updater: TorrentAiTraceState | ((draft: TorrentAiTraceState) => void),
    replace = false,
  ) => {
    if (typeof updater === 'function') {
      if (replace) {
        useTorrentAiTraceStore.setState(updater, true)
      }
      else {
        useTorrentAiTraceStore.setState(updater)
      }
    }
    else {
      useTorrentAiTraceStore.setState(updater, true)
    }
  },
  reset: () => {
    useTorrentAiTraceStore.setState(createInitialState(), true)
  },
}
