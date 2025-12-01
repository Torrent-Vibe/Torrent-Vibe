import type { TorrentInfo, TorrentState } from '~/types/torrent'

import type { TorrentStats } from '../types/store'

export type TorrentStatusGroup =
  | 'downloading'
  | 'seeding'
  | 'completed'
  | 'paused'
  | 'error'

const GROUP_TO_STATES: Record<
  TorrentStatusGroup,
  ReadonlyArray<TorrentState>
> = {
  downloading: [
    'downloading',
    'stalledDL',
    'queuedDL',
    'forcedDL',
    'metaDL',
    'ForcedMetaDL',
  ],
  seeding: ['uploading', 'stalledUP', 'queuedUP', 'forcedUP'],
  completed: ['checkingUP', 'pausedUP', 'stoppedUP'],
  paused: ['pausedDL', 'stoppedDL'],
  error: ['error', 'missingFiles'],
}

export const statusToGroup = (
  state: TorrentState,
): TorrentStatusGroup | null => {
  for (const [group, states] of Object.entries(GROUP_TO_STATES) as Array<
    [TorrentStatusGroup, ReadonlyArray<TorrentState>]
  >) {
    if (states.includes(state)) return group
  }
  return null
}

export const isStatusInGroup = (
  state: TorrentState,
  group: TorrentStatusGroup,
): boolean => {
  return GROUP_TO_STATES[group].includes(state)
}

export const countTorrentStatusGroups = (
  torrents: TorrentInfo[],
): TorrentStats => {
  return torrents.reduce<TorrentStats>(
    (acc, t) => {
      acc.total += 1
      const group = statusToGroup(t.state)
      if (group) {
        acc[group] += 1 as any
      }
      return acc
    },
    { total: 0, downloading: 0, seeding: 0, completed: 0, paused: 0, error: 0 },
  )
}
