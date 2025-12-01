import { openai } from '@ai-sdk/openai'
import { tool } from 'ai'
import { z } from 'zod'

import { getLogger } from '~/config/log-config'
import { detectChromeExecutable as detectChromeExec } from '~/manager/chrome-manager'
import { i18n } from '~/utils/i18n'

import type { SearchEngine } from './search'
import { createSearchTools, resolveSearchOption } from './search'
import type { TmdbClient } from './tmdb-client'
import { extractReadableFromUrl } from './web-extract'

export const detectChromeExecutable = () => detectChromeExec()

// Re-export search functionality for external use
export type { SearchEngine, SearchParams, SearchResponse } from './search'
export {
  chromeManager,
  executeHeadlessSearch,
  searchDuckDuckGo,
  searchGoogle,
  searchWithEngine,
} from './search'

export type ToolMap = Record<string, ReturnType<typeof tool>>

export const createTmdbTools = (tmdbClient: TmdbClient) => {
  const preferredLanguage = i18n.language
  const logger = getLogger('ai.tmdb')
  return {
    tmdbSearch: tool({
      description:
        'Search TMDB for candidates using the inferred original title. Use this to validate year, localized titles, and poster URLs.',
      inputSchema: z.object({
        query: z.string().min(1),
        year: z.number().int().optional(),
        mediaType: z.enum(['movie', 'tv']).optional(),
        language: z
          .string()
          .optional()
          .describe(
            'The language to search for. The language code is in the format of "en-US" or "zh-CN" IETF BCP 47 format.',
          ),
      }),
      execute: async ({ query, year, mediaType, language }) => {
        const result = await tmdbClient.search({
          query,
          year: year ?? null,
          mediaType: mediaType ?? null,
          language: language ?? preferredLanguage,
        })

        if (!result.ok) {
          return {
            ok: false,
            error: result.error ?? 'tmdb.searchFailed',
          }
        }

        logger.info('tmdb search result', { result })

        return {
          ok: true,
          results: result.data?.results ?? [],
        }
      },
    }),
    tmdbDetails: tool({
      description:
        'Fetch detailed TMDB metadata for a candidate, including overview and runtime.',
      inputSchema: z.object({
        id: z.number().int(),
        mediaType: z.enum(['movie', 'tv']),
        language: z.string().optional(),
      }),
      execute: async ({ id, mediaType, language }) => {
        const result = await tmdbClient.details({
          id,
          mediaType,
          language: language ?? preferredLanguage,
        })

        logger.info('tmdb details result', { result })

        if (!result.ok) {
          return {
            ok: false,
            error: result.error ?? 'tmdb.detailsFailed',
          }
        }

        return {
          ok: true,
          data: result.data,
        }
      },
    }),
  }
}

const webExtractTool = {
  webExtractReadable: tool({
    description:
      'Given a URL, open it in headless Chrome, wait for the page to settle, then extract readable article content using Mozilla Readability and return title, byline, excerpt, textContent, html, siteName, lang, and publishedTime.',
    inputSchema: z.object({
      url: z.url(),
    }),
    execute: async ({ url }) => {
      return extractReadableFromUrl(url, 6000)
    },
  }),
}

export const buildAiTools = (options: {
  tmdb?: { client: TmdbClient }
  search?:
    | false
    | 'native'
    | 'headless'
    | {
        mode?: 'native' | 'headless'
        engines?: SearchEngine[]
      }
  webExtract?: boolean
}): ToolMap | undefined => {
  const tools: ToolMap = {}

  if (options.tmdb) {
    Object.assign(tools, createTmdbTools(options.tmdb.client))
  }

  const resolvedSearch = resolveSearchOption(options.search)
  if (resolvedSearch) {
    if (resolvedSearch.mode === 'native') {
      Object.assign(tools, openai.tools.webSearch({}))
    } else {
      Object.assign(
        tools,
        createSearchTools(resolvedSearch.engines, i18n.language),
      )
    }
  }

  if (options.webExtract) {
    Object.assign(tools, webExtractTool)
  }

  return Object.keys(tools).length > 0 ? tools : undefined
}
