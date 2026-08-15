export const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value))

const coerceStringArray = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value
  }
  const trimmed = value.trim()
  return trimmed ? [trimmed] : null
}

const coerceEpisodeNumbers = (value: unknown): unknown => {
  if (value == null) {
    return value
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value : undefined
  }
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return [value]
  }
  return undefined
}

const fillMissingNulls = (
  target: Record<string, unknown>,
  keys: readonly string[],
) => {
  for (const key of keys) {
    if (!(key in target)) {
      target[key] = null
    }
  }
}

export function normalizePayloadShape(
  payload: unknown,
  input?: { rawName: string, language: string },
): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload
  }

  const draft = structuredClone(payload) as Record<string, unknown>

  if (
    (typeof draft.language !== 'string' || !draft.language.trim())
    && input?.language
  ) {
    draft.language = input.language
  }
  if (
    (typeof draft.normalizedName !== 'string' || !draft.normalizedName)
    && input?.rawName
  ) {
    draft.normalizedName = input.rawName
  }

  if (!draft.title || typeof draft.title !== 'object') {
    draft.title = { canonicalTitle: input?.rawName || '' }
  }
  const title = draft.title as Record<string, unknown>
  if (typeof title.canonicalTitle !== 'string' || !title.canonicalTitle) {
    title.canonicalTitle = input?.rawName || ''
  }
  const titleEpisodes = coerceEpisodeNumbers(title.episodeNumbers)
  if (titleEpisodes === undefined) {
    delete title.episodeNumbers
  }
  else {
    title.episodeNumbers = titleEpisodes
  }
  title.extraInfo = coerceStringArray(title.extraInfo)
  fillMissingNulls(title, [
    'localizedTitle',
    'originalTitle',
    'releaseYear',
    'seasonNumber',
    'episodeTitle',
    'languageOfLocalizedTitle',
  ])

  if (draft.series && typeof draft.series === 'object') {
    const series = draft.series as Record<string, unknown>
    const seriesEpisodes = coerceEpisodeNumbers(series.episodeNumbers)
    if (seriesEpisodes === undefined) {
      delete series.episodeNumbers
    }
    else {
      series.episodeNumbers = seriesEpisodes
    }
    if (Array.isArray(series.episodeRange)) {
      const arr = series.episodeRange as unknown[]
      const from = Number(arr[0])
      const to = Number(arr[1])
      if (
        Number.isInteger(from)
        && Number.isInteger(to)
        && from >= 0
        && to >= 0
      ) {
        series.episodeRange = { from, to }
      }
      else {
        delete series.episodeRange
      }
    }
    fillMissingNulls(series, ['seasonNumber', 'totalEpisodesInSeason'])
  }

  if (
    draft.tmdb == null
    || typeof draft.tmdb !== 'object'
    || Array.isArray(draft.tmdb)
  ) {
    draft.tmdb = null
  }
  else {
    const tmdb = draft.tmdb as Record<string, unknown>
    if (typeof tmdb.id !== 'number' || typeof tmdb.title !== 'string') {
      draft.tmdb = null
    }
    else {
      if (typeof tmdb.mediaType !== 'string') {
        tmdb.mediaType = 'movie'
      }
      fillMissingNulls(tmdb, [
        'originalTitle',
        'releaseDate',
        'posterUrl',
        'backdropUrl',
        'overview',
        'rating',
        'votes',
        'language',
        'homepage',
      ])
    }
  }

  if (draft.series === undefined) {
    draft.series = null
  }

  if (!draft.technical || typeof draft.technical !== 'object') {
    draft.technical = {}
  }
  const technical = draft.technical as Record<string, unknown>
  technical.audio = coerceStringArray(technical.audio)
  technical.otherTags = coerceStringArray(technical.otherTags)
  fillMissingNulls(technical, ['resolution', 'videoCodec', 'source', 'edition'])

  if (typeof draft.keywords === 'string') {
    draft.keywords = coerceStringArray(draft.keywords)
  }

  fillMissingNulls(draft, [
    'language',
    'synopsis',
    'previewImageUrl',
    'mayBeTitle',
  ])

  if (typeof draft.normalizedName !== 'string') {
    draft.normalizedName = input?.rawName || ''
  }

  if (
    draft.explanations == null
    && typeof draft.deductions === 'string'
    && draft.deductions.trim()
  ) {
    draft.explanations = [{ heading: null, body: draft.deductions.trim() }]
  }

  if (draft.confidence == null) {
    draft.confidence = {
      overall: 0.5,
      title: null,
      tmdbMatch: null,
      synopsis: null,
    }
  }
  else if (typeof draft.confidence === 'number') {
    draft.confidence = {
      overall: clamp(draft.confidence),
      title: null,
      tmdbMatch: null,
      synopsis: null,
    }
  }
  else if (typeof draft.confidence === 'object') {
    const confidence = draft.confidence as Record<string, unknown>
    if (typeof confidence.overall !== 'number') {
      confidence.overall = 0.5
    }
    else {
      confidence.overall = clamp(confidence.overall as number)
    }
    fillMissingNulls(confidence, ['title', 'tmdbMatch', 'synopsis'])
    draft.confidence = confidence
  }

  return draft
}
