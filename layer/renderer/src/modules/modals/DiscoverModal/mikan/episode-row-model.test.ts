import type { HelperEpisodeState } from '@torrent-vibe/helper-protocol'
import { describe, expect, it } from 'vitest'

import type { TorrentInfo } from '~/types/torrent'

import { buildTorrentHashIndex } from './episode-live-progress'
import { buildEpisodeRowModel } from './episode-row-model'

function torrent(
  partial: Pick<TorrentInfo, 'hash'> & Partial<TorrentInfo>,
): TorrentInfo {
  return {
    added_on: 0,
    amount_left: 0,
    auto_tmm: false,
    availability: 0,
    category: '',
    completed: 0,
    completion_on: 0,
    content_path: '',
    dl_limit: 0,
    dlspeed: 0,
    downloaded: 0,
    downloaded_session: 0,
    eta: 0,
    f_l_piece_prio: false,
    force_start: false,
    last_activity: 0,
    magnet_uri: '',
    max_ratio: 0,
    max_seeding_time: 0,
    name: 'Episode',
    num_complete: 0,
    num_incomplete: 0,
    num_leechs: 0,
    num_seeds: 0,
    priority: 0,
    progress: 0,
    ratio: 0,
    ratio_limit: 0,
    save_path: '',
    seeding_time: 0,
    seeding_time_limit: 0,
    seen_complete: 0,
    seq_dl: false,
    size: 0,
    state: 'downloading',
    super_seeding: false,
    tags: '',
    time_active: 0,
    total_size: 0,
    tracker: '',
    up_limit: 0,
    uploaded: 0,
    uploaded_session: 0,
    upspeed: 0,
    ...partial,
  }
}

const emptyIndex = buildTorrentHashIndex({})

const ALL_STATES: HelperEpisodeState[] = [
  'pending',
  'added',
  'downloading',
  'renaming',
  'done',
  'failed',
  'needs-manual',
  'skipped',
]

describe('buildEpisodeRowModel action rule', () => {
  it.each(ALL_STATES)(
    'unsubscribed %s rows always keep the import action',
    (state) => {
      const model = buildEpisodeRowModel({
        infohash: undefined,
        state,
        subscribed: false,
        torrentIndex: emptyIndex,
      })
      expect(model.actionLabelKey).toBe('discover.modal.mikan.importEpisode')
    },
  )

  it('unsubscribed rows with no known state still keep the import action', () => {
    const model = buildEpisodeRowModel({
      infohash: undefined,
      state: null,
      subscribed: false,
      torrentIndex: emptyIndex,
    })
    expect(model.actionLabelKey).toBe('discover.modal.mikan.importEpisode')
  })

  const subscribedExpectations: Array<{
    state: HelperEpisodeState
    actionLabelKey: I18nKeys | null
  }> = [
    { state: 'pending', actionLabelKey: null },
    { state: 'added', actionLabelKey: null },
    { state: 'downloading', actionLabelKey: null },
    { state: 'renaming', actionLabelKey: null },
    { state: 'done', actionLabelKey: null },
    { state: 'failed', actionLabelKey: null },
    {
      state: 'needs-manual',
      actionLabelKey: 'discover.modal.mikan.downloadAnyway',
    },
    {
      state: 'skipped',
      actionLabelKey: 'discover.modal.mikan.downloadAnyway',
    },
  ]

  it.each(subscribedExpectations)(
    'subscribed $state rows resolve actionLabelKey $actionLabelKey',
    ({ state, actionLabelKey }) => {
      const model = buildEpisodeRowModel({
        infohash: undefined,
        state,
        subscribed: true,
        torrentIndex: emptyIndex,
      })
      expect(model.actionLabelKey).toBe(actionLabelKey)
    },
  )

  it('subscribed rows with no known state drop the action entirely', () => {
    const model = buildEpisodeRowModel({
      infohash: undefined,
      state: null,
      subscribed: true,
      torrentIndex: emptyIndex,
    })
    expect(model.actionLabelKey).toBeNull()
  })
})

describe('buildEpisodeRowModel showRetry', () => {
  it.each(ALL_STATES)('reports showRetry for %s', (state) => {
    const model = buildEpisodeRowModel({
      infohash: undefined,
      state,
      subscribed: true,
      torrentIndex: emptyIndex,
    })
    expect(model.showRetry).toBe(state === 'failed')
  })
})

describe('buildEpisodeRowModel one remedy per problem state', () => {
  const subscribedCases: Array<{
    state: HelperEpisodeState
    showRetry: boolean
    actionLabelKey: I18nKeys | null
  }> = [
    { state: 'failed', showRetry: true, actionLabelKey: null },
    {
      state: 'needs-manual',
      showRetry: false,
      actionLabelKey: 'discover.modal.mikan.downloadAnyway',
    },
    {
      state: 'skipped',
      showRetry: false,
      actionLabelKey: 'discover.modal.mikan.downloadAnyway',
    },
  ]

  it.each(subscribedCases)(
    'subscribed $state rows show exactly one remedy: showRetry=$showRetry actionLabelKey=$actionLabelKey',
    ({ state, showRetry, actionLabelKey }) => {
      const model = buildEpisodeRowModel({
        infohash: undefined,
        state,
        subscribed: true,
        torrentIndex: emptyIndex,
      })
      expect(model.showRetry).toBe(showRetry)
      expect(model.actionLabelKey).toBe(actionLabelKey)
      expect(
        [model.showRetry, model.actionLabelKey !== null].filter(Boolean),
      ).toHaveLength(1)
    },
  )

  const unsubscribedCases: Array<{
    state: HelperEpisodeState
    showRetry: boolean
    actionLabelKey: I18nKeys | null
  }> = [
    {
      state: 'failed',
      showRetry: true,
      actionLabelKey: 'discover.modal.mikan.importEpisode',
    },
    {
      state: 'needs-manual',
      showRetry: false,
      actionLabelKey: 'discover.modal.mikan.importEpisode',
    },
    {
      state: 'skipped',
      showRetry: false,
      actionLabelKey: 'discover.modal.mikan.importEpisode',
    },
  ]

  it.each(unsubscribedCases)(
    'unsubscribed $state rows: showRetry=$showRetry actionLabelKey=$actionLabelKey',
    ({ state, showRetry, actionLabelKey }) => {
      const model = buildEpisodeRowModel({
        infohash: undefined,
        state,
        subscribed: false,
        torrentIndex: emptyIndex,
      })
      expect(model.showRetry).toBe(showRetry)
      expect(model.actionLabelKey).toBe(actionLabelKey)
    },
  )
})

describe('buildEpisodeRowModel badge', () => {
  it('is null when the state is unknown', () => {
    const model = buildEpisodeRowModel({
      infohash: undefined,
      state: null,
      subscribed: false,
      torrentIndex: emptyIndex,
    })
    expect(model.badge).toBeNull()
  })

  it('maps the resolved state to a badge', () => {
    const model = buildEpisodeRowModel({
      infohash: undefined,
      state: 'done',
      subscribed: false,
      torrentIndex: emptyIndex,
    })
    expect(model.badge?.tone).toBe('success')
  })
})

describe('buildEpisodeRowModel live progress and torrent join', () => {
  it('joins on infohash case-insensitively and reports live progress for downloading rows', () => {
    const index = buildTorrentHashIndex({
      ABC123: torrent({ hash: 'ABC123', progress: 0.5, dlspeed: 1_048_576 }),
    })
    const model = buildEpisodeRowModel({
      infohash: 'abc123',
      state: 'downloading',
      subscribed: false,
      torrentIndex: index,
    })
    expect(model.torrentHash).toBe('ABC123')
    expect(model.liveProgress?.displayText).toBe('50% · 1.00 MB/s')
  })

  it('does not report live progress for a non-downloading row even if a torrent matches', () => {
    const index = buildTorrentHashIndex({
      abc123: torrent({ hash: 'abc123', progress: 1 }),
    })
    const model = buildEpisodeRowModel({
      infohash: 'abc123',
      state: 'done',
      subscribed: false,
      torrentIndex: index,
    })
    expect(model.liveProgress).toBeNull()
    expect(model.torrentHash).toBe('abc123')
  })

  it('leaves torrentHash null when no torrent matches the infohash', () => {
    const model = buildEpisodeRowModel({
      infohash: 'missing',
      state: 'downloading',
      subscribed: false,
      torrentIndex: emptyIndex,
    })
    expect(model.torrentHash).toBeNull()
    expect(model.liveProgress).toBeNull()
  })
})
