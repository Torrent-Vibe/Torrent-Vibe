export type TorrentAIMediaType = 'movie' | 'tv' | 'anime' | 'music' | 'other'

export interface TorrentAITitleGuess {
  canonicalTitle: string
  localizedTitle?: string | null
  originalTitle?: string | null
  releaseYear?: number | null
  seasonNumber?: number | null
  episodeNumbers?: number[] | null
  episodeTitle?: string | null
  extraInfo?: string[] | null
  languageOfLocalizedTitle?: string | null
}

export interface TorrentAISeriesInfo {
  seasonNumber?: number | null
  /**
   * Explicit episode numbers present in the release name or file tree
   */
  episodeNumbers?: number[] | null
  /**
   * Compact range representation for multi-episode packs (e.g., { from: 1, to: 2 } for E01–E02)
   */
  episodeRange?: { from: number; to: number } | null
  /**
   * Total episodes in the season when it can be inferred (optional)
   */
  totalEpisodesInSeason?: number | null
}

export interface TorrentAITechnicalInsight {
  resolution?: string | null
  videoCodec?: string | null
  audio?: string[] | null
  source?: string | null
  edition?: string | null
  otherTags?: string[] | null
}

export interface TorrentAITmdbMatch {
  id: number
  mediaType: Extract<TorrentAIMediaType, 'movie' | 'tv' | 'anime'>
  title: string
  originalTitle?: string | null
  releaseDate?: string | null
  posterUrl?: string | null
  backdropUrl?: string | null
  overview?: string | null
  rating?: number | null
  votes?: number | null
  language?: string | null
  homepage?: string | null
}

export interface TorrentAIConfidence {
  overall: number
  title?: number | null
  tmdbMatch?: number | null
  synopsis?: number | null
}

export interface TorrentAIExplanation {
  heading?: string | null
  body?: string | null
}

export interface TorrentAIMetadata {
  rawName: string
  normalizedName: string
  language: string
  mediaType: TorrentAIMediaType
  title: TorrentAITitleGuess
  /**
   * Structured series information. Fields in here may duplicate legacy fields
   * under `title` (seasonNumber, episodeNumbers) for backward compatibility.
   */
  series?: TorrentAISeriesInfo | null
  technical: TorrentAITechnicalInsight
  tmdb?: TorrentAITmdbMatch | null
  synopsis?: string | null
  keywords?: string[] | null
  explanations?: TorrentAIExplanation[] | null
  /** Optional preview image URL to represent the content */
  previewImageUrl?: string | null
  confidence: TorrentAIConfidence
  /** AI-suggested human-readable title for this torrent */
  mayBeTitle?: string | null
  provider?: string | null
  model?: string | null
  generatedAt: string
}

export interface TorrentAIEnrichmentResult {
  ok: boolean
  metadata?: TorrentAIMetadata
  error?: string
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
