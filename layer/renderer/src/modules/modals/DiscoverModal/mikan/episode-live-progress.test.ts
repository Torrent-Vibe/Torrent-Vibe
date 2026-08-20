import { describe, expect, it } from 'vitest'

import type { TorrentInfo } from '~/types/torrent'

import {
  buildTorrentHashIndex,
  episodeLiveProgressFor,
  findTorrentByInfohash,
} from './episode-live-progress'

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

describe('findTorrentByInfohash', () => {
  it('finds the torrent when a lowercase Helper hash matches an uppercase qBittorrent hash', () => {
    const index = buildTorrentHashIndex({
      ABC123: torrent({ hash: 'ABC123' }),
    })
    expect(findTorrentByInfohash('abc123', index)?.hash).toBe('ABC123')
  })

  it('finds the torrent when an uppercase Helper hash matches a lowercase qBittorrent hash', () => {
    const index = buildTorrentHashIndex({
      abc123: torrent({ hash: 'abc123' }),
    })
    expect(findTorrentByInfohash('ABC123', index)?.hash).toBe('abc123')
  })

  it('returns undefined when the infohash is missing', () => {
    const index = buildTorrentHashIndex({
      abc123: torrent({ hash: 'abc123' }),
    })
    expect(findTorrentByInfohash(undefined, index)).toBeUndefined()
  })

  it('returns undefined when no torrent matches', () => {
    const index = buildTorrentHashIndex({
      abc123: torrent({ hash: 'abc123' }),
    })
    expect(findTorrentByInfohash('def456', index)).toBeUndefined()
  })
})

describe('episodeLiveProgressFor', () => {
  it('returns null when the torrent is not present', () => {
    expect(episodeLiveProgressFor(undefined)).toBeNull()
  })

  it('formats percent and speed for a torrent that is actively downloading', () => {
    const result = episodeLiveProgressFor(
      torrent({ hash: 'abc123', progress: 0.634, dlspeed: 4_404_019 }),
    )
    expect(result?.displayText).toBe('63% · 4.20 MB/s')
  })

  it('formats percent only for a torrent that is present but has no speed', () => {
    const result = episodeLiveProgressFor(
      torrent({ hash: 'abc123', progress: 0.5, dlspeed: 0 }),
    )
    expect(result?.displayText).toBe('50%')
  })
})
