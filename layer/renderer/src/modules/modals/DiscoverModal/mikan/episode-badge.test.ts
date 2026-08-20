import type { HelperEpisodeState } from '@torrent-vibe/helper-protocol'
import { describe, expect, it } from 'vitest'

import { EPISODE_BADGE_TONE_CLASS, episodeBadgeFor } from './episode-badge'

describe('episodeBadgeFor', () => {
  const cases: Array<{
    state: HelperEpisodeState
    tone: string
    labelKey: I18nKeys
  }> = [
    {
      state: 'done',
      tone: 'success',
      labelKey: 'discover.modal.mikan.episodeState.done',
    },
    {
      state: 'downloading',
      tone: 'accent',
      labelKey: 'discover.modal.mikan.episodeState.downloading',
    },
    {
      state: 'renaming',
      tone: 'accent',
      labelKey: 'discover.modal.mikan.episodeState.renaming',
    },
    {
      state: 'pending',
      tone: 'neutral',
      labelKey: 'discover.modal.mikan.episodeState.pending',
    },
    {
      state: 'added',
      tone: 'neutral',
      labelKey: 'discover.modal.mikan.episodeState.added',
    },
    {
      state: 'failed',
      tone: 'destructive',
      labelKey: 'discover.modal.mikan.episodeState.failed',
    },
    {
      state: 'needs-manual',
      tone: 'warning',
      labelKey: 'discover.modal.mikan.episodeState.needsManual',
    },
    {
      state: 'skipped',
      tone: 'muted',
      labelKey: 'discover.modal.mikan.episodeState.skipped',
    },
  ]

  it.each(cases)(
    'maps $state to tone $tone with labelKey $labelKey',
    ({ state, tone, labelKey }) => {
      const badge = episodeBadgeFor(state)
      expect(badge.tone).toBe(tone)
      expect(badge.labelKey).toBe(labelKey)
      expect(badge.icon).toMatch(/^i-mingcute-/)
    },
  )

  it('has a tone class for every tone the mapping produces', () => {
    for (const { tone } of cases) {
      expect(
        EPISODE_BADGE_TONE_CLASS[tone as keyof typeof EPISODE_BADGE_TONE_CLASS],
      ).toBeTruthy()
    }
  })
})
