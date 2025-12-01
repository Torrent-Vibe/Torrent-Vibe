import { queryClient } from '~/lib/query/query-client'
import { QueryKeys } from '~/lib/query/query-keys'
import { ApiTokenActions } from '~/modules/api-tokens'
import type {
  DiscoverItem,
  DiscoverItemImdbEnrichment,
  DiscoverItemImdbInfo,
} from '~/modules/discover'

import type { DiscoverActionContext } from '../context'
import { findItemById } from '../utils'

interface LoadImdbOptions {
  force?: boolean
}

interface OMDbData {
  Title?: string
  Year?: string
  Rated?: string
  Released?: string
  Runtime?: string
  Genre?: string
  Director?: string
  Writer?: string
  Actors?: string
  Plot?: string
  Language?: string
  Country?: string
  Awards?: string
  Poster?: string
  Ratings?: unknown[]
  Metascore?: string
  imdbRating?: string
  imdbVotes?: string
  imdbID?: string
  Type?: string
  totalSeasons?: string
  Response: string
  Error?: string
}

const OMDB_BASE_URL = 'https://www.omdbapi.com/'
const FALLBACK_OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY as
  | string
  | undefined

const isElectronEnvironment = typeof ELECTRON !== 'undefined' && ELECTRON

const cloneEnrichment = (
  value: DiscoverItemImdbEnrichment,
): DiscoverItemImdbEnrichment => ({
  ...value,
  genres: value.genres ? [...value.genres] : undefined,
  languages: value.languages ? [...value.languages] : undefined,
  countries: value.countries ? [...value.countries] : undefined,
  directors: value.directors ? [...value.directors] : undefined,
  writers: value.writers ? [...value.writers] : undefined,
  actors: value.actors ? [...value.actors] : undefined,
})

interface ImdbQueryResult {
  enrichment: DiscoverItemImdbEnrichment
}

interface ImdbQueryError extends Error {
  code?: 'missingToken'
}

const sanitizeOmdbNumber = (value: unknown): number | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'N/A') return null
  const normalized = trimmed.replaceAll(',', '')
  const parsed = Number(normalized)
  if (Number.isFinite(parsed)) {
    return parsed
  }
  const fallbackMatch = normalized.match(/^-?\d+(?:\.\d+)?/)
  if (fallbackMatch) {
    const fallback = Number(fallbackMatch[0])
    return Number.isFinite(fallback) ? fallback : null
  }
  return null
}

const parseRuntime = (value: unknown): number | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'N/A') return null

  const hoursMatch = trimmed.match(/(\d+)\s*h/i)
  const minutesMatch = trimmed.match(/(\d+)\s*min/i)

  let totalMinutes = 0
  if (hoursMatch) {
    const hours = Number(hoursMatch[1])
    if (Number.isFinite(hours)) {
      totalMinutes += hours * 60
    }
  }
  if (minutesMatch) {
    const minutes = Number(minutesMatch[1])
    if (Number.isFinite(minutes)) {
      totalMinutes += minutes
    }
  }

  if (totalMinutes > 0) {
    return totalMinutes
  }

  const numeric = Number(trimmed)
  return Number.isFinite(numeric) ? numeric : null
}

const parseList = (value: unknown): string[] => {
  if (typeof value !== 'string') return []
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== 'N/A')
}

const parseYear = (value: unknown): number | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'N/A') return null
  const match = trimmed.match(/\d{4}/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

const parseReleasedDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'N/A') return null
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed.toISOString()
}

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && trimmed !== 'N/A' ? trimmed : null
}

const buildImdbEnrichment = (
  id: string,
  payload: OMDbData,
): DiscoverItemImdbEnrichment => {
  const ratingValue = sanitizeOmdbNumber(payload.imdbRating)
  const rating = ratingValue && ratingValue > 0 ? ratingValue : null
  const votes = sanitizeOmdbNumber(payload.imdbVotes)
  const runtimeMinutes = parseRuntime(payload.Runtime)
  const genres = parseList(payload.Genre)
  const year = parseYear(payload.Year)
  const releasedAt = parseReleasedDate(payload.Released)
  const rated = normalizeString(payload.Rated)
  const type = normalizeString(payload.Type)
  const languages = parseList(payload.Language)
  const countries = parseList(payload.Country)
  const awards = normalizeString(payload.Awards)
  const directors = parseList(payload.Director)
  const writers = parseList(payload.Writer)
  const actors = parseList(payload.Actors)
  const fetchedAt = new Date().toISOString()

  const plot = (() => {
    const raw = payload.Plot
    return typeof raw === 'string' && raw.trim() && raw.trim() !== 'N/A'
      ? raw.trim()
      : null
  })()

  const posterUrl = (() => {
    const raw = payload.Poster
    return typeof raw === 'string' && raw.trim() && raw.trim() !== 'N/A'
      ? raw.trim()
      : null
  })()

  const title = (() => {
    const raw = payload.Title
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null
  })()

  return {
    id,
    title,
    year,
    rating,
    votes,
    runtimeMinutes,
    genres,
    plot,
    posterUrl,
    releasedAt,
    rated,
    type,
    languages,
    countries,
    awards,
    directors,
    writers,
    actors,
    fetchedAt,
  }
}

const resolveOmdbApiKey = async (): Promise<string | null> => {
  if (isElectronEnvironment) {
    const value = await ApiTokenActions.shared.getTokenValue(
      'discover.omdb.apiKey',
    )
    if (value) return value
  }

  const fallback = FALLBACK_OMDB_API_KEY?.trim()
  return fallback && fallback.length > 0 ? fallback : null
}

const fetchImdbMetadata = async (imdbId: string): Promise<ImdbQueryResult> => {
  const apiKey = await resolveOmdbApiKey()
  if (!apiKey) {
    const error: ImdbQueryError = new Error('missingToken')
    error.code = 'missingToken'
    throw error
  }

  const url = new URL(OMDB_BASE_URL)
  url.searchParams.set('i', imdbId)
  url.searchParams.set('apikey', apiKey)
  url.searchParams.set('plot', 'short')
  url.searchParams.set('r', 'json')

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as OMDbData
  if (data.Response === 'False') {
    throw new Error(
      typeof data.Error === 'string' ? data.Error : 'Unknown IMDb error',
    )
  }

  const enrichment = buildImdbEnrichment(imdbId, data)
  return { enrichment }
}

const ensureEnrichmentStatus = (
  imdb: DiscoverItemImdbInfo,
  status: DiscoverItemImdbInfo['enrichmentStatus'],
) => {
  imdb.enrichmentStatus = status
}

const updateItemsWithImdb = (
  draftItems: DiscoverItem[],
  targetId: string,
  updater: (imdb: DiscoverItemImdbInfo, item: DiscoverItem) => void,
) => {
  const target = findItemById(draftItems, targetId)
  if (!target) return
  const imdb = target.external?.imdb
  if (!imdb) return
  updater(imdb, target)
}

export const createEnrichmentSlice = (context: DiscoverActionContext) => {
  const applyImdbUpdate = (
    itemId: string,
    updater: (imdb: DiscoverItemImdbInfo, item: DiscoverItem) => void,
  ) => {
    context.setState((draft) => {
      updateItemsWithImdb(draft.items, itemId, updater)
      const detail = draft.previewDetail
      if (detail?.id === itemId && detail.external?.imdb) {
        updater(detail.external.imdb, detail)
      }
    })
  }

  const loadImdbEnrichment = async (
    itemId: string,
    options?: LoadImdbOptions,
  ) => {
    const state = context.getState()
    const item = findItemById(state.items, itemId)
    const imdb = item?.external?.imdb
    if (!imdb || !imdb.id) {
      return
    }

    if (!options?.force) {
      if (imdb.enrichmentStatus === 'loading') {
        return
      }
      if (imdb.enrichmentStatus === 'success') {
        return
      }
    }

    applyImdbUpdate(itemId, (targetImdb) => {
      ensureEnrichmentStatus(targetImdb, 'loading')
      targetImdb.enrichmentError = undefined
    })

    const imdbQueryKey = QueryKeys.discover.imdb(imdb.id as string)
    if (options?.force) {
      queryClient.removeQueries({ queryKey: imdbQueryKey })
    }

    try {
      const { enrichment } = await queryClient.fetchQuery({
        queryKey: imdbQueryKey,
        queryFn: () => fetchImdbMetadata(imdb.id as string),
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60 * 12,
      })

      const enrichmentClone = cloneEnrichment(enrichment)
      const genres = enrichmentClone.genres ?? []
      const synopsisFromPlot = enrichmentClone.plot ?? null

      applyImdbUpdate(itemId, (targetImdb, targetItem) => {
        ensureEnrichmentStatus(targetImdb, 'success')
        targetImdb.enrichmentError = undefined
        targetImdb.enrichment = enrichmentClone

        if (enrichmentClone.rating && enrichmentClone.rating > 0) {
          targetImdb.rating = enrichmentClone.rating
        } else {
          targetImdb.rating = undefined
        }

        if (genres.length > 0) {
          const tagSet = new Set(targetItem.tags ?? [])
          for (const genre of genres) {
            tagSet.add(genre)
          }
          targetItem.tags = Array.from(tagSet)
        }

        if (!targetItem.synopsis && synopsisFromPlot) {
          targetItem.synopsis = synopsisFromPlot
        }

        if (
          enrichmentClone.votes !== null &&
          enrichmentClone.votes !== undefined
        ) {
          const previousExtra = (targetItem.extra ?? {}) as Record<
            string,
            unknown
          >
          targetItem.extra = {
            ...previousExtra,
            imdbVotes: enrichmentClone.votes,
          }
        }
      })
    } catch (error) {
      console.error(error)
      const imdbError = error as ImdbQueryError
      const message =
        imdbError.code === 'missingToken'
          ? 'missingToken'
          : error instanceof Error
            ? error.message
            : 'Unknown IMDb error'
      applyImdbUpdate(itemId, (targetImdb) => {
        ensureEnrichmentStatus(targetImdb, 'error')
        targetImdb.enrichmentError = message
      })
    }
  }

  return {
    loadImdbEnrichment,
  }
}
