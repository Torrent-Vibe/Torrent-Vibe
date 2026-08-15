import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseBangumiDetail, parseSearchBangumi, parseSeasonWall } from './html'

const fixture = (name: string) =>
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', name),
    'utf8',
  )

const BASE = 'https://mikan.example'

describe('parseSeasonWall', () => {
  it('reads year, season, and weekday-grouped bangumi cards', () => {
    const wall = parseSeasonWall(fixture('season-wall.html'))

    expect(wall.year).toBe(2026)
    expect(wall.season).toBe('夏')

    const byWeekday = new Map(
      wall.groups.map(group => [group.weekday, group.items]),
    )
    expect(byWeekday.get(6)?.map(item => item.bangumiId)).toEqual([
      '3920',
      '3937',
    ])
    expect(byWeekday.get(6)?.[0]).toEqual({
      bangumiId: '3920',
      title: '摩绪',
      coverUrl:
        '/images/Bangumi/202604/edeef072.jpg?width=400&height=400&format=webp',
      weekday: 6,
    })
    expect(byWeekday.get(0)?.[0]).toMatchObject({
      bangumiId: '227',
      title: '名侦探柯南',
      weekday: 0,
    })
    expect(byWeekday.get(7)?.[0]?.title).toBe('剧场版 暗杀教室 大家的时间')
  })
})

describe('parseSearchBangumi', () => {
  it('returns bangumi cards only and ignores torrent rows', () => {
    const cards = parseSearchBangumi(fixture('search.html'))

    expect(cards.map(card => card.bangumiId)).toEqual(['3141', '3821'])
    expect(cards[0]).toEqual({
      bangumiId: '3141',
      title: '葬送的芙莉莲',
      coverUrl:
        '/images/Bangumi/202309/5ce9fed1.jpg?width=400&height=400&format=webp',
    })
    expect(cards[1]?.title).toBe('葬送的芙莉莲 第二季')
    expect(
      cards.some(
        card =>
          card.bangumiId.includes('9a7b7d3a') || card.title.includes('7³ACG'),
      ),
    ).toBe(false)
  })
})

describe('parseBangumiDetail', () => {
  it('splits subgroups and episodes and resolves torrent urls', () => {
    const detail = parseBangumiDetail(
      fixture('bangumi-detail.html'),
      '3141',
      BASE,
    )

    expect(detail.bangumiId).toBe('3141')
    expect(detail.title).toBe('葬送的芙莉莲')
    expect(detail.coverUrl).toBe(
      '/images/Bangumi/202309/5ce9fed1.jpg?width=400&height=560&format=webp',
    )
    expect(detail.bangumiSubjectId).toBe('400602')
    expect(detail.subgroups).toEqual([
      { id: '583', name: 'ANi' },
      { id: '370', name: 'LoliHouse' },
    ])
    expect(detail.episodes).toHaveLength(2)
    expect(detail.episodes[0]).toEqual({
      episodeId: 'a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c',
      subgroupId: '583',
      title:
        '[ANi] Sōsō no Frieren /  葬送的芙莉莲 - 28 [1080P][Baha][WEB-DL][AAC AVC][CHT][MP4]',
      torrentUrl: `${BASE}/Download/20240322/a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c.torrent`,
      sizeBytes: Math.round(710.4 * 1024 * 1024),
      publishedAt: '2024/03/22 23:31',
    })
    expect(detail.episodes[1]).toMatchObject({
      episodeId: 'ae49d7fc3a508076996f0c438d73b24d7f27855d',
      subgroupId: '370',
      title:
        '[喵萌奶茶屋&LoliHouse] 葬送的芙莉莲 / Sousou no Frieren - 28 [WebRip 1080p HEVC-10bit AAC][简繁日内封字幕][End]',
    })
  })
})
