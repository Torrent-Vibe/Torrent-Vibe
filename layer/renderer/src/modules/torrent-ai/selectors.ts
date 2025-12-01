import type { TorrentAiState } from './types'

export const selectTorrentAiEntry = (state: TorrentAiState, hash: string) =>
  state.entries[hash]
