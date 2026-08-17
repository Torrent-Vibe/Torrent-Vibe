export type TorrentAIMediaType = 'movie' | 'tv' | 'anime' | 'music' | 'other'

export interface TorrentAITitleGuess {
  canonicalTitle: string
  episodeNumbers?: number[] | null
  episodeTitle?: string | null
  extraInfo?: string[] | null
  languageOfLocalizedTitle?: string | null
  localizedTitle?: string | null
  originalTitle?: string | null
  releaseYear?: number | null
  seasonNumber?: number | null
}

export interface TorrentAISeriesInfo {
  /**
   * Explicit episode numbers present in the release name or file tree
   */
  episodeNumbers?: number[] | null
  /**
   * Compact range representation for multi-episode packs (e.g., { from: 1, to: 2 } for E01–E02)
   */
  episodeRange?: { from: number; to: number } | null
  seasonNumber?: number | null
  /**
   * Total episodes in the season when it can be inferred (optional)
   */
  totalEpisodesInSeason?: number | null
}

export interface TorrentAITechnicalInsight {
  audio?: string[] | null
  edition?: string | null
  otherTags?: string[] | null
  resolution?: string | null
  source?: string | null
  videoCodec?: string | null
}

export interface TorrentAITmdbMatch {
  backdropUrl?: string | null
  homepage?: string | null
  id: number
  language?: string | null
  mediaType: Extract<TorrentAIMediaType, 'movie' | 'tv' | 'anime'>
  originalTitle?: string | null
  overview?: string | null
  posterUrl?: string | null
  rating?: number | null
  releaseDate?: string | null
  title: string
  votes?: number | null
}

export interface TorrentAIConfidence {
  overall: number
  synopsis?: number | null
  title?: number | null
  tmdbMatch?: number | null
}

export interface TorrentAIExplanation {
  body?: string | null
  heading?: string | null
}

export interface TorrentAIMetadata {
  confidence: TorrentAIConfidence
  explanations?: TorrentAIExplanation[] | null
  generatedAt: string
  keywords?: string[] | null
  language: string
  /** AI-suggested human-readable title for this torrent */
  mayBeTitle?: string | null
  mediaType: TorrentAIMediaType
  model?: string | null
  normalizedName: string
  /** Optional preview image URL to represent the content */
  previewImageUrl?: string | null
  provider?: string | null
  rawName: string
  /**
   * Structured series information. Fields in here may duplicate legacy fields
   * under `title` (seasonNumber, episodeNumbers) for backward compatibility.
   */
  series?: TorrentAISeriesInfo | null
  synopsis?: string | null
  technical: TorrentAITechnicalInsight
  title: TorrentAITitleGuess
  tmdb?: TorrentAITmdbMatch | null
}

export interface TorrentAIEnrichmentResult {
  error?: string
  metadata?: TorrentAIMetadata
  ok: boolean
  transient?: boolean
}

export const createEmptyTorrentAIMetadata = (
  rawName: string,
  language: string,
): TorrentAIMetadata => ({
  rawName,
  normalizedName: rawName,
  language,
  mediaType: 'other',
  title: {
    canonicalTitle: rawName,
  },
  technical: {},
  synopsis: null,
  keywords: null,
  explanations: null,
  previewImageUrl: null,
  confidence: {
    overall: 0,
    title: null,
    tmdbMatch: null,
    synopsis: null,
  },
  provider: null,
  model: null,
  generatedAt: new Date().toISOString(),
})
