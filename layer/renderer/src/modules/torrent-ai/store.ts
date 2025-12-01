import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createWithEqualityFn } from 'zustand/traditional'

import { getI18n } from '~/i18n'

import type { TorrentAiEntry, TorrentAiState } from './types'

const createInitialState = (): TorrentAiState => ({
  initialized: false,
  entries: {},
})

export const useTorrentAiStore = createWithEqualityFn<TorrentAiState>()(
  subscribeWithSelector(immer(createInitialState)),
)

export const torrentAiStore = {
  getState: () => useTorrentAiStore.getState(),
  setState: (
    updater: TorrentAiState | ((draft: TorrentAiState) => void),
    replace = false,
  ) => {
    if (typeof updater === 'function') {
      if (replace) {
        useTorrentAiStore.setState(updater, true)
      } else {
        useTorrentAiStore.setState(updater)
      }
    } else {
      useTorrentAiStore.setState(updater, true)
    }
  },
  reset: () => {
    useTorrentAiStore.setState(createInitialState(), true)
  },
}

export const ensureEntry = (hash: string, rawName: string): TorrentAiEntry => {
  const state = torrentAiStore.getState()
  const existing = state.entries[hash]
  if (existing) {
    return existing
  }

  const entry: TorrentAiEntry = {
    hash,
    rawName,
    language: getI18n().language,
    status: 'idle',
    metadata: null,
    error: null,
    requestedAt: null,
    updatedAt: null,
    retries: 0,
  }

  torrentAiStore.setState((draft) => {
    draft.entries[hash] = entry
  })

  return entry
}

export const resetTorrentAiStore = torrentAiStore.reset
