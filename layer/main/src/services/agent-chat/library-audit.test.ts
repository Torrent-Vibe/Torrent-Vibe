import type { TorrentInfo } from '@torrent-vibe/qb-client'
import { describe, expect, it } from 'vitest'

import { auditTorrents } from './library-audit'

const torrent = (
  fields: Pick<TorrentInfo, 'hash' | 'name' | 'state'> &
    Partial<
      Pick<TorrentInfo, 'category' | 'content_path' | 'save_path' | 'tags'>
    >,
): TorrentInfo =>
  ({
    category: '',
    content_path: '',
    save_path: '/downloads',
    tags: '',
    ...fields,
  }) as TorrentInfo

describe('auditTorrents', () => {
  it('flags missingFiles and error as missing_files', () => {
    const result = auditTorrents([
      torrent({
        hash: 'missing-a',
        name: 'Lost A',
        state: 'missingFiles',
      }),
      torrent({
        hash: 'error-b',
        name: 'Lost B',
        state: 'error',
      }),
    ])

    const issues = result.issues.filter(
      (issue) => issue.kind === 'missing_files',
    )
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hash: 'missing-a',
          kind: 'missing_files',
          name: 'Lost A',
        }),
        expect.objectContaining({
          hash: 'error-b',
          kind: 'missing_files',
          name: 'Lost B',
        }),
      ]),
    )
    expect(issues).toHaveLength(2)
    expect(result.byState).toEqual({ error: 1, missingFiles: 1 })
    expect(result).toMatchObject({
      hasMore: false,
      nextOffset: null,
      scanned: 2,
      total: 2,
    })
  })

  it('flags stripped-name matches as one duplicate issue with two member hashes', () => {
    const result = auditTorrents([
      torrent({
        category: 'TV',
        content_path: '/downloads/[Group] Show - 01.mkv',
        hash: 'dup-a',
        name: '[Group] Show - 01.mkv',
        save_path: '/downloads',
        state: 'stoppedUP',
      }),
      torrent({
        category: 'TV',
        content_path: '/downloads/[Other] Show - 01.mkv',
        hash: 'dup-b',
        name: '[Other] Show - 01.mkv',
        save_path: '/downloads',
        state: 'stoppedUP',
      }),
    ])

    const duplicates = result.issues.filter(
      (issue) => issue.kind === 'duplicate',
    )
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0]?.memberHashes).toHaveLength(2)
    expect(duplicates[0]?.memberHashes).toEqual(
      expect.arrayContaining(['dup-a', 'dup-b']),
    )
  })

  it('flags tv-mikan tags as helper_managed and not a reason to delete', () => {
    const result = auditTorrents([
      torrent({
        category: 'Bangumi',
        hash: 'helper-a',
        name: 'Show - 01',
        save_path: '/downloads/Bangumi/Show/Season 01',
        state: 'stoppedUP',
        tags: 'keep,tv-mikan:abc',
      }),
    ])

    const helperIssues = result.issues.filter(
      (issue) => issue.kind === 'helper_managed',
    )
    expect(helperIssues).toHaveLength(1)
    expect(helperIssues[0]).toMatchObject({
      hash: 'helper-a',
      kind: 'helper_managed',
      tags: expect.arrayContaining(['tv-mikan:abc']),
    })
    expect(result.helper).toEqual([
      { hashes: ['helper-a'], savePath: '/downloads/Bangumi/Show' },
    ])
  })

  it('strips Season folders into observedRoots and flags layout_inconsistent', () => {
    const result = auditTorrents([
      torrent({
        category: 'Bangumi',
        hash: 'layout-a',
        name: 'Show - 01',
        save_path: '/downloads/Bangumi/Show/Season 1',
        state: 'stoppedUP',
      }),
      torrent({
        category: 'Bangumi',
        hash: 'layout-b',
        name: 'Show - 02',
        save_path: '/downloads/Bangumi/Show/Season 01',
        state: 'stoppedUP',
      }),
    ])

    expect(result.observedRoots).toContain('/downloads/Bangumi/Show')
    const layouts = result.issues.filter(
      (issue) => issue.kind === 'layout_inconsistent',
    )
    expect(layouts.length).toBeGreaterThan(0)
    expect(
      layouts.some((issue) =>
        (issue.memberHashes ?? [issue.hash]).includes('layout-a'),
      ),
    ).toBe(true)
  })

  it('flags empty category as uncategorized', () => {
    const result = auditTorrents([
      torrent({
        hash: 'none-a',
        name: 'Orphan',
        state: 'stoppedUP',
      }),
    ])

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: '',
          hash: 'none-a',
          kind: 'uncategorized',
        }),
      ]),
    )
    expect(result.byCategory).toEqual({ '': 1 })
  })

  it('flags Movie torrents on a different path cluster as path_category_mismatch', () => {
    const result = auditTorrents([
      torrent({
        category: 'Movie',
        hash: 'movie-a',
        name: 'Film A',
        save_path: '/downloads/Movie',
        state: 'stoppedUP',
      }),
      torrent({
        category: 'Movie',
        hash: 'movie-b',
        name: 'Film B',
        save_path: '/downloads/Movie',
        state: 'stoppedUP',
      }),
      torrent({
        category: 'Movie',
        hash: 'movie-c',
        name: 'Film C',
        save_path: '/downloads/PT/Books',
        state: 'stoppedUP',
      }),
    ])

    const mismatches = result.issues.filter(
      (issue) => issue.kind === 'path_category_mismatch',
    )
    expect(mismatches.some((issue) => issue.hash === 'movie-c')).toBe(true)
    expect(mismatches.every((issue) => issue.hash !== 'movie-a')).toBe(true)
  })
})
