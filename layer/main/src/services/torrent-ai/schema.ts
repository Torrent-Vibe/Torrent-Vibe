import { z } from 'zod'

export const TorrentAiMediaTypeSchema = z
  .enum(['movie', 'tv', 'anime', 'music', 'other'])
  .default('other')

export const TorrentAiTitleSchema = z.object({
  canonicalTitle: z.string().min(1),
  localizedTitle: z.string().trim().min(1).nullable().default(null),
  originalTitle: z.string().trim().min(1).nullable().default(null),
  releaseYear: z.number().int().min(1900).max(2100).nullable().default(null),
  seasonNumber: z.number().int().min(0).nullable().default(null),
  episodeNumbers: z
    .array(z.number().int().min(0))
    .nonempty()
    .nullable()
    .default(null),
  episodeTitle: z.string().trim().nullable().default(null),
  extraInfo: z.array(z.string().trim()).nullable().default(null),
  languageOfLocalizedTitle: z.string().trim().nullable().default(null),
})

export const TorrentAiSeriesSchema = z.object({
  seasonNumber: z.number().int().min(0).nullable().default(null),
  episodeNumbers: z
    .array(z.number().int().min(0))
    .nonempty()
    .nullable()
    .default(null),
  episodeRange: z
    .object({ from: z.number().int().min(0), to: z.number().int().min(0) })
    .nullable()
    .default(null),
  totalEpisodesInSeason: z.number().int().min(0).nullable().default(null),
})

export const TorrentAiTechnicalSchema = z.object({
  resolution: z.string().trim().nullable().default(null),
  videoCodec: z.string().trim().nullable().default(null),
  audio: z.array(z.string().trim()).nullable().default(null),
  source: z.string().trim().nullable().default(null),
  edition: z.string().trim().nullable().default(null),
  otherTags: z.array(z.string().trim()).nullable().default(null),
})

export const TorrentAiTmdbSchema = z.object({
  id: z.number().int(),
  mediaType: z.enum(['movie', 'tv', 'anime']).default('movie'),
  title: z.string().trim(),
  originalTitle: z.string().trim().nullable().default(null),
  releaseDate: z.string().trim().nullable().default(null),
  posterUrl: z.string().trim().nullable().default(null),
  backdropUrl: z.string().trim().nullable().default(null),
  overview: z.string().trim().nullable().default(null),
  rating: z.number().min(0).max(10).nullable().default(null),
  votes: z.number().int().min(0).nullable().default(null),
  language: z.string().trim().nullable().default(null),
  homepage: z.string().trim().nullable().default(null),
})

export const TorrentAiConfidenceSchema = z
  .object({
    overall: z.number().min(0).max(1).default(0.5),
    title: z.number().min(0).max(1).nullable().default(null),
    tmdbMatch: z.number().min(0).max(1).nullable().default(null),
    synopsis: z.number().min(0).max(1).nullable().default(null),
  })
  .default({ overall: 0.5, title: null, tmdbMatch: null, synopsis: null })

export const TorrentAiExplanationSchema = z.object({
  heading: z.string().trim().nullable().default(null),
  body: z.string().trim().nullable().default(null),
})

export const TorrentAiMetadataSchema = z.object({
  language: z.string().trim().default('zh-CN').nullable(),
  normalizedName: z.string().trim().default(''),
  mediaType: TorrentAiMediaTypeSchema,
  title: TorrentAiTitleSchema,
  series: TorrentAiSeriesSchema.nullable(),
  // Default technical fields to explicit nulls to satisfy strict required schema
  technical: TorrentAiTechnicalSchema.default({
    resolution: null,
    videoCodec: null,
    audio: null,
    source: null,
    edition: null,
    otherTags: null,
  }),
  // Ensure OpenAI strict schema has present-but-null fields for absent values
  synopsis: z.string().trim().nullable().default(null),
  keywords: z.array(z.string().trim()).nullable().default(null),
  explanations: z.array(TorrentAiExplanationSchema).nullable().default(null),
  previewImageUrl: z.string().trim().nullable().default(null),
  tmdb: TorrentAiTmdbSchema.nullable(),
  confidence: TorrentAiConfidenceSchema,
  mayBeTitle: z.string().trim().nullable().default(null),
})

export type TorrentAiMetadataPayload = z.infer<typeof TorrentAiMetadataSchema>
