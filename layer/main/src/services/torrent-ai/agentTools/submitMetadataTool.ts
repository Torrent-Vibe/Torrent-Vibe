import type { AgentTool } from '@earendil-works/pi-agent-core'
import type { Static } from '@earendil-works/pi-ai'
import { StringEnum, Type } from '@earendil-works/pi-ai'

import { normalizePayloadShape } from '../normalize-payload'

export const SUBMIT_METADATA_TOOL_NAME = 'submitMetadata'

const nullableString = Type.Union([Type.String(), Type.Null()])
const nullableNumber = Type.Union([Type.Number(), Type.Null()])

const mediaTypeSchema = StringEnum(['movie', 'tv', 'anime', 'music', 'other'])

const titleSchema = Type.Object({
  canonicalTitle: Type.String({ minLength: 1 }),
  localizedTitle: nullableString,
  originalTitle: nullableString,
  releaseYear: nullableNumber,
  seasonNumber: nullableNumber,
  episodeNumbers: Type.Optional(Type.Array(Type.Number(), { minItems: 1 })),
  episodeTitle: nullableString,
  extraInfo: Type.Optional(Type.Array(Type.String())),
  languageOfLocalizedTitle: nullableString,
})

const seriesSchema = Type.Object({
  seasonNumber: nullableNumber,
  episodeNumbers: Type.Optional(Type.Array(Type.Number(), { minItems: 1 })),
  episodeRange: Type.Optional(
    Type.Object({
      from: Type.Number(),
      to: Type.Number(),
    }),
  ),
  totalEpisodesInSeason: nullableNumber,
})

const technicalSchema = Type.Object({
  resolution: nullableString,
  videoCodec: nullableString,
  audio: Type.Optional(Type.Array(Type.String())),
  source: nullableString,
  edition: nullableString,
  otherTags: Type.Optional(Type.Array(Type.String())),
})

const tmdbSchema = Type.Object({
  id: Type.Number(),
  mediaType: StringEnum(['movie', 'tv', 'anime']),
  title: Type.String(),
  originalTitle: nullableString,
  releaseDate: nullableString,
  posterUrl: nullableString,
  backdropUrl: nullableString,
  overview: nullableString,
  rating: nullableNumber,
  votes: nullableNumber,
  language: nullableString,
  homepage: nullableString,
})

const confidenceSchema = Type.Object({
  overall: Type.Number({ minimum: 0, maximum: 1 }),
  title: nullableNumber,
  tmdbMatch: nullableNumber,
  synopsis: nullableNumber,
})

const explanationSchema = Type.Object({
  heading: nullableString,
  body: nullableString,
})

export const submitMetadataSchema = Type.Object({
  language: nullableString,
  normalizedName: Type.String(),
  mediaType: mediaTypeSchema,
  title: titleSchema,
  series: Type.Optional(seriesSchema),
  technical: technicalSchema,
  synopsis: nullableString,
  keywords: Type.Optional(Type.Array(Type.String())),
  explanations: Type.Optional(Type.Array(explanationSchema)),
  previewImageUrl: nullableString,
  tmdb: Type.Optional(tmdbSchema),
  confidence: Type.Optional(confidenceSchema),
  mayBeTitle: nullableString,
})

export function buildSubmitMetadataTool(): AgentTool<
  typeof submitMetadataSchema,
  { payload: Static<typeof submitMetadataSchema> }
> {
  return {
    name: SUBMIT_METADATA_TOOL_NAME,
    label: 'Submit Metadata',
    description:
      'Submit the final torrent metadata object. Call this once after research, alone, as the last action. Do not print JSON as assistant text.',
    parameters: submitMetadataSchema,
    constrainedSampling: { type: 'json_schema', strict: 'prefer' },
    prepareArguments: args =>
      normalizePayloadShape(args) as Static<typeof submitMetadataSchema>,
    execute: async (_id, params) => ({
      content: [{ type: 'text', text: 'Metadata accepted.' }],
      details: { payload: params },
      terminate: true,
    }),
  }
}
