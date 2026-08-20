import type { HelperEpisodeState } from '@torrent-vibe/helper-protocol'

export type EpisodeBadgeTone =
  'accent' | 'destructive' | 'muted' | 'neutral' | 'success' | 'warning'

export interface EpisodeBadge {
  icon: string
  labelKey: I18nKeys
  tone: EpisodeBadgeTone
}

const EPISODE_BADGES: Record<HelperEpisodeState, EpisodeBadge> = {
  pending: {
    icon: 'i-mingcute-time-line',
    tone: 'neutral',
    labelKey: 'discover.modal.mikan.episodeState.pending',
  },
  added: {
    icon: 'i-mingcute-time-line',
    tone: 'neutral',
    labelKey: 'discover.modal.mikan.episodeState.added',
  },
  downloading: {
    icon: 'i-mingcute-download-2-line',
    tone: 'accent',
    labelKey: 'discover.modal.mikan.episodeState.downloading',
  },
  renaming: {
    icon: 'i-mingcute-edit-line',
    tone: 'accent',
    labelKey: 'discover.modal.mikan.episodeState.renaming',
  },
  done: {
    icon: 'i-mingcute-check-circle-line',
    tone: 'success',
    labelKey: 'discover.modal.mikan.episodeState.done',
  },
  failed: {
    icon: 'i-mingcute-close-circle-line',
    tone: 'destructive',
    labelKey: 'discover.modal.mikan.episodeState.failed',
  },
  'needs-manual': {
    icon: 'i-mingcute-alert-line',
    tone: 'warning',
    labelKey: 'discover.modal.mikan.episodeState.needsManual',
  },
  skipped: {
    icon: 'i-mingcute-forbid-circle-line',
    tone: 'muted',
    labelKey: 'discover.modal.mikan.episodeState.skipped',
  },
}

export const episodeBadgeFor = (state: HelperEpisodeState): EpisodeBadge =>
  EPISODE_BADGES[state]

export const EPISODE_BADGE_TONE_CLASS: Record<EpisodeBadgeTone, string> = {
  success: 'border-green/20 bg-green/10 text-green',
  accent: 'border-accent/20 bg-accent/10 text-accent',
  neutral: 'border-border bg-fill-secondary text-text-secondary',
  destructive: 'border-red/20 bg-red/10 text-red',
  warning: 'border-orange/20 bg-orange/10 text-orange',
  muted: 'border-border bg-fill text-text-tertiary',
}
