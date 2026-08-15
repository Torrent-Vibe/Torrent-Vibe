import type { MikanProviderConfig } from '~/atoms/settings/discover'

export const MIKAN_SEASONS = ['春', '夏', '秋', '冬'] as const

export type MikanSeasonStr = (typeof MIKAN_SEASONS)[number]

const SEASON_ALIASES: Record<string, MikanSeasonStr> = {
  春: '春',
  夏: '夏',
  秋: '秋',
  冬: '冬',
  spring: '春',
  summer: '夏',
  autumn: '秋',
  fall: '秋',
  winter: '冬',
}

export const invariant = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message)
  }
}

export const ensureConfigReady = (config: MikanProviderConfig) => {
  invariant(config.enabled, 'Mikan provider is disabled')
  invariant(Boolean(config.baseUrl.trim()), 'Mikan base URL is missing')
}

export const handleErrorResponse = async (response: Response) => {
  const fallback = `${response.status} ${response.statusText}`
  try {
    const text = await response.text()
    throw new Error(text.trim() || fallback)
  }
  catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error(fallback)
  }
}

export const resolveMikanSeason = (value: unknown): MikanSeasonStr | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  return (
    SEASON_ALIASES[trimmed] ?? SEASON_ALIASES[trimmed.toLowerCase()] ?? null
  )
}

export const getCurrentMikanSeason = (
  date = new Date(),
): { year: number, season: MikanSeasonStr } => {
  const month = date.getMonth()
  const year = date.getFullYear()
  if (month <= 2) {
    return { year, season: '冬' }
  }
  if (month <= 5) {
    return { year, season: '春' }
  }
  if (month <= 8) {
    return { year, season: '夏' }
  }
  return { year, season: '秋' }
}

export const resolveSeasonWallQuery = (
  filters: Record<string, unknown> = {},
) => {
  const current = getCurrentMikanSeason()
  const yearRaw = filters.year
  const parsedYear
    = typeof yearRaw === 'number'
      ? yearRaw
      : typeof yearRaw === 'string' && yearRaw.trim()
        ? Number(yearRaw)
        : Number.NaN
  const year = Number.isFinite(parsedYear) ? parsedYear : current.year
  const season = resolveMikanSeason(filters.season) ?? current.season
  return { year, season }
}

export interface MikanEpisodeExtra {
  episodeId: string
  subgroupId: string
  title: string
  torrentUrl: string
  sizeBytes?: number
  publishedAt?: string
}

export interface MikanBangumiExtra {
  kind: 'bangumi'
  weekday?: number
  coverUrl?: string
  bangumiSubjectId?: string
  subgroups?: Array<{ id: string, name: string }>
  episodes?: MikanEpisodeExtra[]
}

export const asMikanBangumiExtra = (
  extra: Record<string, unknown> | undefined,
): MikanBangumiExtra | null => {
  if (!extra || extra.kind !== 'bangumi') {
    return null
  }
  return extra as unknown as MikanBangumiExtra
}

export const findEpisodeTorrentUrl = (
  extra: Record<string, unknown> | undefined,
  episodeId: string,
): string | null => {
  const bangumi = asMikanBangumiExtra(extra)
  const match = bangumi?.episodes?.find(
    episode => episode.episodeId === episodeId,
  )
  return match?.torrentUrl || null
}
