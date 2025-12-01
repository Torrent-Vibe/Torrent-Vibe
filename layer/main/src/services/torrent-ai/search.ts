import { tool } from 'ai'
import { dialog } from 'electron'
import log from 'electron-log'
import type { Page } from 'puppeteer-core'
import { z } from 'zod'

import {
  ChromeLaunchError,
  chromeManager as globalChromeManager,
  ChromeNotFoundError,
  ChromePageError,
} from '~/manager/chrome-manager'
import { ConcurrencyGate } from '~/utils/concurrency-gate'
import { i18n } from '~/utils/i18n'

// Types
export type SearchEngine = 'google' | 'duckduckgo'

export type SearchResult = {
  title: string
  url: string
  snippet: string | null
  siteName?: string | null
}

export type SearchExecutionArgs = {
  query: string
  language: string
  maxResults: number
}

export type SearchParams = {
  query: string
  language?: string
  maxResults: number
  safe?: boolean
}

export type SearchResponse =
  | {
      ok: true
      results: SearchResult[]
    }
  | {
      ok: false
      error: string
    }

export type SearchExtractor = () => SearchResult[]

export type SearchEngineConfig = {
  key: string
  engine: SearchEngine
  description: string
  logScope: string
  defaultLanguage: string

  maxResultsLimit: number
  supportsSafeSearch?: boolean
  normalizeLanguage?: (
    language: string | undefined,
    fallback: string | undefined,
  ) => string
  buildUrl: (input: SearchExecutionArgs) => string
  detectBlock?: (currentUrl: string) => string | undefined
  parseErrorKey: string
  navigationErrorKey: string
  blockedErrorKey: string
  waitSelectors: string[]
  waitTimeoutMs?: number
  extractor: SearchExtractor
}

// Constants
const INTERACTIVE_SOLVE_TIMEOUT_MS = 2 * 60 * 1000
const INTERACTIVE_POLL_INTERVAL_MS = 1500

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const searchConcurrencyGate = new ConcurrencyGate(5)
const interactiveSolveGate = new ConcurrencyGate(1)

export const chromeManager = globalChromeManager

// Search Extractors
const googleExtractor: SearchExtractor = () => {
  // Prefer stable attributes and structure over obfuscated class names
  const seen = new Set<Element>()
  const out: SearchResult[] = []

  const decodeGoogleUrl = (href: string) => {
    const base =
      typeof window !== 'undefined' && window.location !== undefined
        ? window.location.origin
        : 'https://www.google.com'
    try {
      const url = new URL(href, base)
      if (url.pathname === '/url') {
        const real = url.searchParams.get('q')
        if (real) return real
      }
      return url.href
    } catch {
      return href
    }
  }

  const getSiteNameFromHref = (href: string) => {
    const base =
      typeof window !== 'undefined' && window.location !== undefined
        ? window.location.origin
        : 'https://www.google.com'
    try {
      const url = new URL(href, base)
      const host = url.hostname || ''
      return host.replace(/^www\./, '')
    } catch {
      return null
    }
  }

  const pushResult = (
    title: string | null,
    url: string | null,
    snippet: string | null,
  ) => {
    if (!title || !title.trim()) return
    if (!url || !url.trim()) return
    const siteName = getSiteNameFromHref(url)
    out.push({
      title: title.trim(),
      url: url.trim(),
      snippet: snippet?.trim() || null,
      siteName,
    })
  }

  // Use headings within #search as primary anchors
  const headingNodes = Array.from(
    document.querySelectorAll<HTMLHeadingElement>('#search a h3'),
  )
  for (const heading of headingNodes) {
    const anchor = heading.closest('a') as HTMLAnchorElement | null
    if (!anchor) continue
    if (seen.has(anchor)) continue
    seen.add(anchor)

    const href = decodeGoogleUrl(
      anchor.getAttribute('href') || anchor.href || '',
    )

    // Find a nearby container and snippet
    const container =
      anchor.closest('div[data-hveid]') ||
      anchor.closest('#search') ||
      anchor.parentElement

    let snippet: string | null = null
    const snippetNode =
      (container &&
        (container.querySelector('div[data-sncf]') as HTMLElement | null)) ||
      null
    if (snippetNode) {
      snippet = snippetNode.textContent || ''
    } else if (container) {
      // Fallback: choose a nearby text block with reasonable length
      const candidates = Array.from(
        container.querySelectorAll<HTMLElement>('p, span, div'),
      )
      for (const el of candidates) {
        const text = (el.textContent || '').trim()
        if (text && text.length >= 40 && text.length <= 400) {
          snippet = text
          break
        }
      }
    }

    const title = heading.textContent || ''
    pushResult(title, href, snippet)
  }

  if (out.length === 0) {
    const headings = Array.from(
      document.querySelectorAll<HTMLHeadingElement>('#search a h3'),
    ).slice(0, 20)
    for (const heading of headings) {
      const anchor = heading.closest('a') as HTMLAnchorElement | null
      if (!anchor) continue
      const href = decodeGoogleUrl(
        anchor.getAttribute('href') || anchor.href || '',
      )
      const title = heading.textContent || ''
      // Try to find a sibling snippet near the heading
      let snippet: string | null = null
      const container =
        anchor.closest('div[data-hveid]') || anchor.parentElement
      if (container) {
        const candidate = container.querySelector(
          'div[data-sncf]',
        ) as HTMLElement | null
        if (candidate) snippet = candidate.textContent || ''
      }
      pushResult(title, href, snippet)
    }
  }

  return out
}

const duckduckgoExtractor: SearchExtractor = () => {
  const resultAnchors = [
    'a[data-testid="result-title-a"]',
    '#links .result__a',
    'a.result__a',
    'div#links article a[href]',
  ]

  const out: SearchResult[] = []
  const seen = new Set<Element>()

  const decodeDuckDuckGoUrl = (href: string) => {
    try {
      const base =
        typeof window !== 'undefined' && window.location !== undefined
          ? window.location.origin
          : 'https://duckduckgo.com'
      const url = new URL(href, base)
      // DDG often uses redirect links like /l/?uddg=ENCODED
      if (url.pathname.startsWith('/l/') && url.searchParams.has('uddg')) {
        const real = url.searchParams.get('uddg')
        if (real) return decodeURIComponent(real)
      }
      return url.href
    } catch {
      return href
    }
  }

  const getSiteNameFromHref = (href: string) => {
    try {
      const base =
        typeof window !== 'undefined' && window.location !== undefined
          ? window.location.origin
          : 'https://duckduckgo.com'
      const url = new URL(href, base)
      const host = url.hostname || ''
      return host.replace(/^www\./, '')
    } catch {
      return null
    }
  }

  const pushResult = (
    title: string | null,
    url: string | null,
    snippet: string | null,
  ) => {
    if (!title || !title.trim()) return
    if (!url || !url.trim()) return
    const siteName = getSiteNameFromHref(url)
    out.push({
      title: title.trim(),
      url: url.trim(),
      snippet: snippet?.trim() || null,
      siteName,
    })
  }

  for (const selector of resultAnchors) {
    const anchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(selector),
    )
    for (const anchor of anchors) {
      if (seen.has(anchor)) continue
      seen.add(anchor)

      const href = decodeDuckDuckGoUrl(
        anchor.getAttribute('href') || anchor.href || '',
      )
      const title =
        anchor.textContent || anchor.querySelector('h2')?.textContent || ''

      // Try to find a nearby snippet
      let snippet: string | null = null
      const container =
        anchor.closest(
          'article,[data-testid="result"],[data-nrn="result"],li[data-layout="organic"]',
        ) || anchor.parentElement
      let snippetNode =
        (container &&
          (container.querySelector(
            '[data-result="snippet"]',
          ) as HTMLElement | null)) ||
        null
      if (!snippetNode && container) {
        snippetNode = container.querySelector(
          '[data-testid="result-snippet"], .result__snippet, p',
        ) as HTMLElement | null
      }
      snippet = snippetNode ? snippetNode.textContent || '' : null

      pushResult(title, href, snippet)
    }
  }

  if (out.length === 0) {
    const fallbackAnchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href] h2'),
    )
      .slice(0, 20)
      .map((h) => h.closest('a') as HTMLAnchorElement | null)
      .filter(Boolean) as HTMLAnchorElement[]
    for (const a of fallbackAnchors) {
      const href = decodeDuckDuckGoUrl(a.getAttribute('href') || a.href || '')
      const title = a.textContent || ''
      pushResult(title, href, null)
    }
  }

  return out
}

// Search Engine Configuration
export const DEFAULT_SEARCH_ENGINES: SearchEngine[] = ['google', 'duckduckgo']

export const SEARCH_ENGINE_CONFIG: Record<SearchEngine, SearchEngineConfig> = {
  google: {
    key: 'googleSearch',
    engine: 'google',
    description:
      'Perform a Chrome-powered Google search to find authoritative references. Returns organic results with title, url, siteName, and snippet.',
    logScope: 'ai.google',
    defaultLanguage: 'en',

    maxResultsLimit: 20,
    supportsSafeSearch: true,
    normalizeLanguage: (language, fallback) => language || fallback || 'en',
    buildUrl: ({ query, language, maxResults }) => {
      const params = new URLSearchParams({
        q: query,
        hl: language,
        num: String(maxResults),
        pws: '0',
        safe: 'off',
        gws_rd: 'ssl',
      })
      return `https://www.google.com/search?${params.toString()}`
    },
    detectBlock: (currentUrl) => {
      if (!currentUrl) return
      if (currentUrl.includes('/sorry/') || currentUrl.includes('consent.')) {
        return 'ai.google.blocked'
      }
      return
    },
    parseErrorKey: 'ai.google.parseFailed',
    navigationErrorKey: 'ai.google.navigationFailed',
    blockedErrorKey: 'ai.google.blocked',
    waitSelectors: [
      '#search a h3',
      '#search div[data-hveid]',
      '#search div[data-sncf]',
    ],
    waitTimeoutMs: 8000,
    extractor: googleExtractor,
  },
  duckduckgo: {
    key: 'duckduckgoSearch',
    engine: 'duckduckgo',
    description:
      'Perform a Chrome-powered DuckDuckGo search to gather references. Returns organic results with title, url, siteName, and snippet.',
    logScope: 'ai.duckduckgo',
    defaultLanguage: 'en-US',

    maxResultsLimit: 20,
    supportsSafeSearch: true,
    normalizeLanguage: (language, fallback) => language || fallback || 'en-US',
    buildUrl: ({ query, language }) => {
      const params = new URLSearchParams({
        q: query,
        kp: '-2',
        ia: 'web',
      })
      // Accept-Language header will carry the locale; DDG also supports kl like 'us-en'
      // but it's not strictly needed for relevant results.
      if (language) {
        const [lang, region] = language.split('-')
        if (lang && region) {
          params.set('kl', `${region.toLowerCase()}-${lang.toLowerCase()}`)
        }
      }
      return `https://duckduckgo.com/?${params.toString()}`
    },
    detectBlock: (currentUrl) => {
      if (!currentUrl) return
      if (currentUrl.includes('captcha') || currentUrl.includes('/sorry/')) {
        return 'ai.duckduckgo.blocked'
      }
      return
    },
    parseErrorKey: 'ai.duckduckgo.parseFailed',
    navigationErrorKey: 'ai.duckduckgo.navigationFailed',
    blockedErrorKey: 'ai.duckduckgo.blocked',
    waitSelectors: [
      'a[data-testid="result-title-a"]',
      '#links .result__a',
      'div#links article a[href]',
      '[data-result="snippet"]',
    ],
    waitTimeoutMs: 8000,
    extractor: duckduckgoExtractor,
  },
}

// Interactive Search Solving
const runInteractiveSolve = async (options: {
  searchUrl: string
  config: SearchEngineConfig
  maxResults: number
}): Promise<SearchResult[] | null> => {
  const { searchUrl, config, maxResults } = options
  await interactiveSolveGate.acquire()

  let page: Page | null = null

  try {
    await chromeManager.closeHeadless()
    page = await chromeManager.newInteractivePage()
    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    await dialog.showMessageBox({
      type: 'info',
      title: i18n.t('ai.search.solveVerification.title'),
      message: i18n.t('ai.search.solveVerification.message'),
    })

    const deadline = Date.now() + INTERACTIVE_SOLVE_TIMEOUT_MS
    while (Date.now() < deadline) {
      try {
        const results = (await page.evaluate(
          config.extractor,
        )) as SearchResult[]
        if (Array.isArray(results) && results.length > 0) {
          log.info(`[${config.logScope}] interactive solve succeeded`, {
            count: results.length,
          })
          return results.slice(0, maxResults)
        }
      } catch (error) {
        log.debug(`[${config.logScope}] interactive polling failed`, { error })
      }
      await delay(INTERACTIVE_POLL_INTERVAL_MS)
    }

    log.warn(`[${config.logScope}] interactive solve timed out`)
    return null
  } catch (error) {
    log.error(`[${config.logScope}] interactive solve failed`, { error })
    return null
  } finally {
    try {
      if (page && !page.isClosed()) {
        await page.close()
      }
    } catch (error) {
      log.warn('[ai.chrome] failed to close interactive page', { error })
    }

    try {
      await chromeManager.closeInteractive()
    } catch (error) {
      log.warn('[ai.chrome] failed to close interactive browser', { error })
    }

    interactiveSolveGate.release()
  }
}

// Core Search Logic
export const executeHeadlessSearch = async (
  config: SearchEngineConfig,
  params: SearchParams,
  preferredLanguage?: string,
): Promise<SearchResponse> => {
  await searchConcurrencyGate.acquire()

  const resolvedLanguage =
    config.normalizeLanguage?.(params.language, preferredLanguage) ||
    params.language ||
    preferredLanguage ||
    config.defaultLanguage

  const num = Math.min(Math.max(params.maxResults, 1), config.maxResultsLimit)

  const searchArgs: SearchExecutionArgs = {
    query: params.query,
    language: resolvedLanguage,
    maxResults: num,
  }
  const searchUrl = config.buildUrl(searchArgs)

  log.debug(`[${config.logScope}] performing search`, {
    query: params.query,
    language: resolvedLanguage,
    maxResults: num,
    searchUrl,
  })

  let page: Page | null = null

  try {
    page = await chromeManager.newPage()
    await page.setExtraHTTPHeaders({
      'Accept-Language': resolvedLanguage,
    })

    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: config.waitTimeoutMs ?? 12000,
    })

    const currentUrl = page.url()
    const blockedKey = config.detectBlock?.(currentUrl)
    if (blockedKey) {
      await page.close().catch((error) => {
        log.warn(`[${config.logScope}] closing blocked page failed`, {
          error,
        })
      })
      page = null

      const interactiveResults = await runInteractiveSolve({
        searchUrl,
        config,
        maxResults: num,
      })

      if (interactiveResults && interactiveResults.length > 0) {
        return {
          ok: true,
          results: interactiveResults,
        }
      }

      return { ok: false, error: blockedKey }
    }

    if (config.waitSelectors.length > 0) {
      try {
        await page.waitForFunction(
          (selectors: string[]) =>
            selectors.some((selector) =>
              Boolean(document.querySelector(selector)),
            ),
          { timeout: config.waitTimeoutMs ?? 8000 },
          config.waitSelectors,
        )
      } catch (waitError) {
        log.debug(`[${config.logScope}] waitForFunction timed out`, {
          waitError,
          query: params.query,
        })
      }
    }

    const results = await page.evaluate(config.extractor)

    log.info(`[${config.logScope}] search results`, {
      count: Array.isArray(results) ? results.length : 0,
    })

    if (!Array.isArray(results)) {
      return { ok: false, error: config.parseErrorKey }
    }

    log.info(`[${config.logScope}] search results`, {
      results,
    })

    return {
      ok: true,
      results: results.slice(0, num),
    }
  } catch (error) {
    log.error(`[${config.logScope}] search failed`, {
      query: params.query,
      error,
    })
    if (error instanceof ChromeNotFoundError) {
      return { ok: false, error: 'ai.search.chromeNotFound' }
    }
    if (error instanceof ChromeLaunchError) {
      return { ok: false, error: 'ai.search.chromeLaunchFailed' }
    }
    if (error instanceof ChromePageError) {
      return { ok: false, error: 'ai.search.chromePageFailed' }
    }

    const isParseIssue = error instanceof Error && error.name === 'TimeoutError'
    if (isParseIssue) {
      return { ok: false, error: config.parseErrorKey }
    }
    return { ok: false, error: config.navigationErrorKey }
  } finally {
    if (page) {
      try {
        if (!page.isClosed()) {
          await page.close()
        }
      } catch (closeError) {
        log.warn(`[${config.logScope}] failed to close tab`, closeError)
      }
    }
    searchConcurrencyGate.release()
  }
}

// Search Tool Creation
const createHeadlessSearchTool = (
  config: SearchEngineConfig,
  preferredLanguage: string | undefined,
) => {
  return tool({
    description: config.description,
    inputSchema: z.object({
      query: z.string().min(1),
      language: z
        .string()
        .optional()
        .describe(
          'The UI language (IETF BCP 47) for search results, e.g., "en-US", "zh-CN".',
        ),
    }),
    execute: async ({ query, language }) => {
      return executeHeadlessSearch(
        config,
        { query, language, maxResults: 20, safe: false },
        preferredLanguage,
      )
    },
  })
}

// Convenience functions for direct search engine access
export const searchGoogle = async (
  params: SearchParams,
  preferredLanguage?: string,
): Promise<SearchResponse> => {
  return executeHeadlessSearch(
    SEARCH_ENGINE_CONFIG.google,
    params,
    preferredLanguage,
  )
}

export const searchDuckDuckGo = async (
  params: SearchParams,
  preferredLanguage?: string,
): Promise<SearchResponse> => {
  return executeHeadlessSearch(
    SEARCH_ENGINE_CONFIG.duckduckgo,
    params,
    preferredLanguage,
  )
}

export const searchWithEngine = async (
  engine: SearchEngine,
  params: SearchParams,
  preferredLanguage?: string,
): Promise<SearchResponse> => {
  const config = SEARCH_ENGINE_CONFIG[engine]
  if (!config) {
    return { ok: false, error: `Unknown search engine: ${engine}` }
  }
  return executeHeadlessSearch(config, params, preferredLanguage)
}

export const createSearchTools = (
  engines: SearchEngine[],
  preferredLanguage: string | undefined,
) => {
  const tools: Record<string, ReturnType<typeof tool>> = {}
  const uniqueEngines = Array.from(new Set(engines))
  for (const engine of uniqueEngines) {
    const config = SEARCH_ENGINE_CONFIG[engine]
    if (!config) continue
    Reflect.set(
      tools,
      config.key,
      createHeadlessSearchTool(config, preferredLanguage),
    )
  }
  return tools
}

export const resolveSearchOption = (
  searchOption:
    | false
    | 'native'
    | 'headless'
    | {
        mode?: 'native' | 'headless'
        engines?: SearchEngine[]
      }
    | undefined,
):
  | {
      mode: 'native'
    }
  | {
      mode: 'headless'
      engines: SearchEngine[]
    }
  | undefined => {
  if (!searchOption) return undefined
  if (searchOption === 'native') return { mode: 'native' }
  if (searchOption === 'headless') {
    return { mode: 'headless', engines: DEFAULT_SEARCH_ENGINES }
  }
  const mode = searchOption.mode ?? 'headless'
  if (mode === 'native') return { mode: 'native' }
  const engines =
    searchOption.engines && searchOption.engines.length > 0
      ? searchOption.engines
      : DEFAULT_SEARCH_ENGINES
  return { mode: 'headless', engines }
}
