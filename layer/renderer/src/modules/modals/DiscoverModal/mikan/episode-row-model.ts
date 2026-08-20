import type { HelperEpisodeState } from '@torrent-vibe/helper-protocol'

import type { EpisodeBadge } from './episode-badge'
import { episodeBadgeFor } from './episode-badge'
import type {
  EpisodeLiveProgress,
  TorrentHashIndex,
} from './episode-live-progress'
import {
  episodeLiveProgressFor,
  findTorrentByInfohash,
} from './episode-live-progress'

export interface EpisodeRowModel {
  actionLabelKey: I18nKeys | null
  badge: EpisodeBadge | null
  liveProgress: EpisodeLiveProgress | null
  showRetry: boolean
  torrentHash: string | null
}

const resolveActionLabelKey = (
  subscribed: boolean,
  state: HelperEpisodeState | null,
): I18nKeys | null => {
  if (!subscribed) {
    return 'discover.modal.mikan.importEpisode'
  }
  if (state === 'skipped' || state === 'needs-manual') {
    return 'discover.modal.mikan.downloadAnyway'
  }
  return null
}

export const buildEpisodeRowModel = (input: {
  infohash: string | undefined
  state: HelperEpisodeState | null
  subscribed: boolean
  torrentIndex: TorrentHashIndex
}): EpisodeRowModel => {
  const { infohash, state, subscribed, torrentIndex } = input
  const torrent = findTorrentByInfohash(infohash, torrentIndex)
  return {
    actionLabelKey: resolveActionLabelKey(subscribed, state),
    badge: state ? episodeBadgeFor(state) : null,
    liveProgress:
      state === 'downloading' ? episodeLiveProgressFor(torrent) : null,
    showRetry: state === 'failed',
    torrentHash: torrent?.hash ?? null,
  }
}
