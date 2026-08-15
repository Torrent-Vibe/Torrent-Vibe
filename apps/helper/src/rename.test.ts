import { describe, expect, it } from 'vitest'

import { formatEpisodeName, formatSavePath, planEpisodeRenames } from './rename'

describe('formatEpisodeName', () => {
  it('formats title - SxxExx with zero-padded season and episode', () => {
    expect(formatEpisodeName('葬送的芙莉莲', 1, 28)).toBe(
      '葬送的芙莉莲 - S01E28',
    )
    expect(formatEpisodeName('Example Show', 2, 7)).toBe(
      'Example Show - S02E07',
    )
  })
})

describe('formatSavePath', () => {
  it('joins libraryRoot / title / Season XX', () => {
    expect(formatSavePath('/library', '葬送的芙莉莲', 1)).toBe(
      '/library/葬送的芙莉莲/Season 01',
    )
    expect(formatSavePath('/library', 'Example Show', 2)).toBe(
      '/library/Example Show/Season 02',
    )
  })
})

describe('planEpisodeRenames', () => {
  it('renames the main video and matching subtitle, keeping language suffixes', () => {
    expect(
      planEpisodeRenames({
        displayName: '葬送的芙莉莲 - S01E28',
        files: [
          { name: '[ANi] 葬送的芙莉莲 - 28 [1080P].mp4', size: 700_000_000 },
          { name: '[ANi] 葬送的芙莉莲 - 28 [1080P].cht.ass', size: 40_000 },
        ],
      }),
    ).toEqual([
      {
        from: '[ANi] 葬送的芙莉莲 - 28 [1080P].mp4',
        to: '葬送的芙莉莲 - S01E28.mp4',
      },
      {
        from: '[ANi] 葬送的芙莉莲 - 28 [1080P].cht.ass',
        to: '葬送的芙莉莲 - S01E28.cht.ass',
      },
    ])
  })

  it('skips Sample, NCOP, and NCED files', () => {
    expect(
      planEpisodeRenames({
        displayName: 'Show - S01E01',
        files: [
          { name: 'Show/Show - 01.mkv', size: 1_000_000_000 },
          { name: 'Show/Sample/Show - 01 Sample.mkv', size: 20_000_000 },
          { name: 'Show/NCOP/Show NCOP.mkv', size: 50_000_000 },
          { name: 'Show/NCED/Show NCED.mkv', size: 50_000_000 },
          { name: 'Show/Show - 01.ass', size: 30_000 },
        ],
      }),
    ).toEqual([
      { from: 'Show/Show - 01.mkv', to: 'Show/Show - S01E01.mkv' },
      { from: 'Show/Show - 01.ass', to: 'Show/Show - S01E01.ass' },
    ])
  })

  it('does not plan a rename when names already match', () => {
    expect(
      planEpisodeRenames({
        displayName: 'Show - S01E01',
        files: [{ name: 'Show - S01E01.mkv', size: 1 }],
      }),
    ).toEqual([])
  })

  it('picks the largest non-extra video as the main file', () => {
    expect(
      planEpisodeRenames({
        displayName: 'Show - S01E01',
        files: [
          { name: 'Show/Show - 01.mkv', size: 2_000_000_000 },
          { name: 'Show/Show - 01 extra commentary.mp4', size: 80_000_000 },
          { name: 'Show/Show - 01.srt', size: 20_000 },
        ],
      }),
    ).toEqual([
      { from: 'Show/Show - 01.mkv', to: 'Show/Show - S01E01.mkv' },
      { from: 'Show/Show - 01.srt', to: 'Show/Show - S01E01.srt' },
    ])
  })
})
