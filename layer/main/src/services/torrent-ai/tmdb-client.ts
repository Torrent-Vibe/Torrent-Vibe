import log from 'electron-log'

import { PersistentLRUCache } from '../../utils/persistent-lru-cache'

const TMDB_API_BASE = 'https://api.themoviedb.org/3/'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'
const DEFAULT_POSTER_SIZE = 'w342'
const DEFAULT_BACKDROP_SIZE = 'w780'

interface SearchParams {
  query: string
  year?: number | null
  language?: string | null
  mediaType?: 'movie' | 'tv' | null
}

interface DetailParams {
  id: number
  mediaType: 'movie' | 'tv'
  language?: string | null
}

export interface TmdbSearchResult {
  id: number
  mediaType: 'movie' | 'tv'
  title: string
  originalTitle: string | null
  releaseDate: string | null
  overview: string | null
  posterUrl: string | null
  backdropUrl: string | null
  rating: number | null
  votes: number | null
  language: string | null
}

export interface TmdbDetailResult extends TmdbSearchResult {
  homepage: string | null
  runtimeMinutes: number | null
  episodeCount?: number | null
  seasonCount?: number | null
}

interface RequestResult<T> {
  ok: boolean
  data?: T
  error?: string
  status?: number
  tookMs?: number
}

export class TmdbClient {
  private apiKey: string | null = null
  private readonly cache: PersistentLRUCache<{
    createdAt: number
    data: unknown
  }>

  constructor() {
    this.cache = new PersistentLRUCache<{ createdAt: number; data: unknown }>({
      fileName: 'tmdb-cache.json',
      namespace: 'tmdb-client.v1',
      limit: 800,
      ttlMs: 24 * 60 * 60 * 1000, // 1 day
      createdAtSelector: (value) => value.createdAt,
    })
  }

  setApiKey(apiKey: string | null) {
    const next = apiKey?.trim() ? apiKey.trim() : null
    const changed = this.apiKey !== next
    this.apiKey = next
    if (changed) {
      try {
        this.cache.clear()
      } catch {
        // ignore
      }
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey)
  }

  async search(
    params: SearchParams,
  ): Promise<RequestResult<{ results: TmdbSearchResult[] }>> {
    if (!this.apiKey) {
      return { ok: false, error: 'tmdb.notConfigured' }
    }

    try {
      const endpoint = this.pickSearchEndpoint(params.mediaType)
      const { data, tookMs } = await this.request<any>(endpoint, {
        query: params.query,
        include_adult: 'false',
        page: '1',
        language: params.language ?? undefined,
        year:
          params.mediaType === 'movie' && params.year
            ? String(params.year)
            : undefined,
        first_air_date_year:
          params.mediaType === 'tv' && params.year
            ? String(params.year)
            : undefined,
      })

      if (!data?.results || !Array.isArray(data.results)) {
        return { ok: true, data: { results: [] }, tookMs }
      }

      const results: TmdbSearchResult[] = []
      for (const entry of data.results) {
        const mapped = this.mapSearchEntry(entry)
        if (mapped) {
          results.push(mapped)
        }
      }

      return { ok: true, data: { results }, tookMs }
    } catch (error) {
      log.warn('[tmdb] search failed', {
        query: params.query,
        mediaType: params.mediaType,
        error,
      })
      return { ok: false, error: 'tmdb.requestFailed' }
    }
  }

  async details(
    params: DetailParams,
  ): Promise<RequestResult<TmdbDetailResult>> {
    if (!this.apiKey) {
      return { ok: false, error: 'tmdb.notConfigured' }
    }

    try {
      const path =
        params.mediaType === 'movie' ? `movie/${params.id}` : `tv/${params.id}`
      const { data, tookMs } = await this.request<any>(path, {
        language: params.language ?? undefined,
      })

      if (!data) {
        return { ok: false, error: 'tmdb.emptyResponse' }
      }

      const base = this.mapSearchEntry({
        ...data,
        media_type: params.mediaType,
      })
      if (!base) {
        return { ok: false, error: 'tmdb.unsupportedMediaType' }
      }

      const detail: TmdbDetailResult = {
        ...base,
        homepage: data.homepage ?? null,
        runtimeMinutes:
          typeof data.runtime === 'number'
            ? data.runtime
            : typeof data.episode_run_time?.[0] === 'number'
              ? data.episode_run_time[0]
              : null,
        episodeCount:
          typeof data.number_of_episodes === 'number'
            ? data.number_of_episodes
            : null,
        seasonCount:
          typeof data.number_of_seasons === 'number'
            ? data.number_of_seasons
            : null,
      }

      return { ok: true, data: detail, tookMs }
    } catch (error) {
      log.warn('[tmdb] details failed', {
        id: params.id,
        mediaType: params.mediaType,
        error,
      })
      return { ok: false, error: 'tmdb.requestFailed' }
    }
  }

  private async request<T>(
    path: string,
    searchParams: Record<string, string | undefined>,
  ): Promise<{ data: T; tookMs: number }> {
    if (!this.apiKey) {
      throw new Error('tmdb.notConfigured')
    }

    const normalizedPath = path.replaceAll(/^\/+/g, '')
    const cacheKey = this.buildCacheKey(normalizedPath, searchParams)
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return { data: cached.data as T, tookMs: 0 }
    }
    const url = new URL(normalizedPath, TMDB_API_BASE)

    const token = this.apiKey.trim()

    for (const [key, value] of Object.entries(searchParams)) {
      if (value == null || value === '') continue
      url.searchParams.set(key, value)
    }

    const started = Date.now()
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }

    const bearer = token.replace(/^Bearer\s+/i, '')
    headers.Authorization = `Bearer ${bearer}`

    const response = await fetch(url, { headers })

    if (!response.ok) {
      const message = await response.text().catch(() => '')
      throw new Error(
        `tmdb.httpError:${response.status}:${response.statusText || ''}:${message}`,
      )
    }

    const data = (await response.json()) as T
    try {
      this.cache.set(cacheKey, { createdAt: Date.now(), data })
    } catch {
      // ignore cache write errors
    }
    return { data, tookMs: Date.now() - started }
  }

  private pickSearchEndpoint(mediaType: SearchParams['mediaType']): string {
    if (mediaType === 'movie') return 'search/movie'
    if (mediaType === 'tv') return 'search/tv'
    return 'search/multi'
  }

  private mapSearchEntry(entry: any): TmdbSearchResult | null {
    if (!entry) return null
    const mediaType: 'movie' | 'tv' | null = this.resolveMediaType(entry)
    if (!mediaType) return null

    const titleField =
      mediaType === 'movie'
        ? (entry.title ?? entry.name)
        : (entry.name ?? entry.title)
    if (!titleField || typeof titleField !== 'string') return null

    return {
      id: Number(entry.id),
      mediaType,
      title: titleField,
      originalTitle:
        typeof entry.original_title === 'string'
          ? entry.original_title
          : typeof entry.original_name === 'string'
            ? entry.original_name
            : null,
      releaseDate:
        mediaType === 'movie'
          ? (entry.release_date ?? null)
          : (entry.first_air_date ?? null),
      overview:
        typeof entry.overview === 'string' && entry.overview.trim()
          ? entry.overview
          : null,
      posterUrl: this.buildImageUrl(entry.poster_path, DEFAULT_POSTER_SIZE),
      backdropUrl: this.buildImageUrl(
        entry.backdrop_path,
        DEFAULT_BACKDROP_SIZE,
      ),
      rating:
        typeof entry.vote_average === 'number'
          ? Number(entry.vote_average.toFixed(2))
          : null,
      votes: typeof entry.vote_count === 'number' ? entry.vote_count : null,
      language:
        typeof entry.original_language === 'string'
          ? entry.original_language
          : null,
    }
  }

  private resolveMediaType(entry: any): 'movie' | 'tv' | null {
    const explicit =
      typeof entry.media_type === 'string' ? entry.media_type : null
    if (explicit === 'movie' || explicit === 'tv') {
      return explicit
    }

    if (
      typeof entry.release_date === 'string' ||
      typeof entry.original_title === 'string'
    ) {
      return 'movie'
    }

    if (
      typeof entry.first_air_date === 'string' ||
      typeof entry.original_name === 'string'
    ) {
      return 'tv'
    }

    return null
  }

  private buildImageUrl(path: unknown, size: string): string | null {
    if (!path || typeof path !== 'string') return null
    return `${TMDB_IMAGE_BASE}/${size}${path}`
  }

  private buildCacheKey(
    path: string,
    params: Record<string, string | undefined>,
  ): string {
    const normalizedPath = path.replaceAll(/^\/+/g, '')
    const parts = Object.entries(params)
      .filter(([, v]) => v != null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
    return parts.length > 0
      ? `${normalizedPath}?${parts.join('&')}`
      : normalizedPath
  }
}
