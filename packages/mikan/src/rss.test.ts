import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseBangumiRss } from './rss'
import { bangumiRssUrl, joinMikanUrl, torrentDownloadUrl } from './urls'

const fixture = (name: string) =>
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', name),
    'utf8',
  )

const BASE = 'https://mikan.example'

describe('mikan urls', () => {
  it('joins a relative Mikan path onto the base', () => {
    expect(joinMikanUrl('https://mikanani.me', '/Home/Bangumi/3141')).toBe(
      'https://mikanani.me/Home/Bangumi/3141',
    )
  })

  it('builds a bangumi+subgroup RSS url', () => {
    expect(bangumiRssUrl('https://mikanani.me', '3141', '583')).toBe(
      'https://mikanani.me/RSS/Bangumi?bangumiId=3141&subgroupid=583',
    )
  })

  it('rewrites a torrent href onto the configured base', () => {
    expect(
      torrentDownloadUrl(
        BASE,
        'https://mikanani.me/Download/20240322/a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c.torrent',
      ),
    ).toBe(
      `${BASE}/Download/20240322/a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c.torrent`,
    )
  })
})

describe('parseBangumiRss', () => {
  it('parses episode id, title, torrent url, size, and pub date from a saved feed', () => {
    const episodes = parseBangumiRss(fixture('rss.xml'), BASE)

    expect(episodes).toHaveLength(2)
    expect(episodes[0]).toEqual({
      episodeId: 'a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c',
      title:
        '[ANi] Sōsō no Frieren /  葬送的芙莉莲 - 28 [1080P][Baha][WEB-DL][AAC AVC][CHT][MP4]',
      torrentUrl: `${BASE}/Download/20240322/a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c.torrent`,
      publishedAt: '2024-03-22T23:31:49.457',
      sizeBytes: 744908416,
    })
    expect(episodes[1]?.episodeId).toBe(
      '238eeb554bcd07b86335c8f8d402a69c11b15789',
    )
    expect(episodes[1]?.sizeBytes).toBe(653388672)
  })
})
