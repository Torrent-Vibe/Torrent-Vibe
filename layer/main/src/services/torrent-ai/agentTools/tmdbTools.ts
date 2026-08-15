import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'
import { Type } from '@earendil-works/pi-ai'

import { getLogger } from '~/config/log-config'
import { i18n } from '~/utils/i18n'

import type { TmdbClient } from '../tmdb-client'

const textResult = (
  value: unknown,
): AgentToolResult<Record<string, never>> => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  details: {},
})

const tmdbSearchSchema = Type.Object({
  query: Type.String(),
  year: Type.Optional(Type.Number()),
  mediaType: Type.Optional(
    Type.Union([Type.Literal('movie'), Type.Literal('tv')]),
  ),
  language: Type.Optional(Type.String()),
})

const tmdbDetailsSchema = Type.Object({
  id: Type.Number(),
  mediaType: Type.Union([Type.Literal('movie'), Type.Literal('tv')]),
  language: Type.Optional(Type.String()),
})

export function buildTmdbTools(tmdbClient: TmdbClient): AgentTool[] {
  const preferredLanguage = i18n.language
  const logger = getLogger('ai.tmdb')

  const tmdbSearch: AgentTool<typeof tmdbSearchSchema> = {
    name: 'tmdbSearch',
    label: 'TMDB Search',
    description:
      'Search TMDB for candidates using the inferred original title. Use this to validate year, localized titles, and poster URLs.',
    parameters: tmdbSearchSchema,
    execute: async (_id, { query, year, mediaType, language }) => {
      const result = await tmdbClient.search({
        query,
        year: year ?? null,
        mediaType: mediaType ?? null,
        language: language ?? preferredLanguage,
      })
      if (!result.ok) {
        return textResult({
          ok: false,
          error: result.error ?? 'tmdb.searchFailed',
        })
      }
      logger.info('tmdb search result', { result })
      return textResult({
        ok: true,
        results: result.data?.results ?? [],
      })
    },
  }

  const tmdbDetails: AgentTool<typeof tmdbDetailsSchema> = {
    name: 'tmdbDetails',
    label: 'TMDB Details',
    description:
      'Fetch detailed TMDB metadata for a candidate, including overview and runtime.',
    parameters: tmdbDetailsSchema,
    execute: async (_id, { id, mediaType, language }) => {
      const result = await tmdbClient.details({
        id,
        mediaType,
        language: language ?? preferredLanguage,
      })
      logger.info('tmdb details result', { result })
      if (!result.ok) {
        return textResult({
          ok: false,
          error: result.error ?? 'tmdb.detailsFailed',
        })
      }
      return textResult({ ok: true, data: result.data })
    },
  }

  return [tmdbSearch, tmdbDetails]
}
