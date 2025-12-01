import { torrentAiStore } from '../store'
import type { TorrentAiState } from '../types'

export interface TorrentAiActionContext {
  getState: () => TorrentAiState
  setState: (
    updater: TorrentAiState | ((draft: TorrentAiState) => void),
    replace?: boolean,
  ) => void
}

export const createActionContext = (): TorrentAiActionContext => ({
  getState: torrentAiStore.getState,
  setState: torrentAiStore.setState,
})
