import { describe, expect, it } from 'vitest'

import { parseMikanTitle } from './title'

describe('parseMikanTitle', () => {
  it('parses ANi dash episode and leaves season null', () => {
    expect(parseMikanTitle('[ANi] 葬送的芙莉莲 - 28 [1080P]')).toEqual({
      title: '葬送的芙莉莲',
      season: null,
      episode: 28,
    })
  })

  it('parses a real ANi title with romaji slash name', () => {
    expect(
      parseMikanTitle(
        '[ANi] Sōsō no Frieren /  葬送的芙莉莲 - 28 [1080P][Baha][WEB-DL][AAC AVC][CHT][MP4]',
      ),
    ).toEqual({
      title: '葬送的芙莉莲',
      season: null,
      episode: 28,
    })
  })

  it('returns null episode when the number is missing', () => {
    expect(parseMikanTitle('[ANi] 葬送的芙莉莲 [1080P]')).toEqual({
      title: '葬送的芙莉莲',
      season: null,
      episode: null,
    })
  })

  it('parses S02E07', () => {
    expect(
      parseMikanTitle('[LoliHouse] Example Show S02E07 [WebRip 1080p]'),
    ).toEqual({
      title: 'Example Show',
      season: 2,
      episode: 7,
    })
  })

  it('parses 第07集', () => {
    expect(parseMikanTitle('[字幕组] 示例番 第07集 [1080P]')).toEqual({
      title: '示例番',
      season: null,
      episode: 7,
    })
  })

  it('does not invent an episode from a collection range', () => {
    expect(
      parseMikanTitle(
        '[喵萌奶茶屋&LoliHouse] 葬送的芙莉莲 / Sousou no Frieren [01-28 修正合集][WebRip 1080p HEVC-10bit AAC][简繁日内封字幕][Fin]',
      ),
    ).toEqual({
      title: '葬送的芙莉莲',
      season: null,
      episode: null,
    })
  })
})
