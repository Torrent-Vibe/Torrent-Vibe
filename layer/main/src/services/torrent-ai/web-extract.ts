import { isProbablyReaderable, Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

import { getLogger } from '~/config/log-config'
import {
  ChromeLaunchError,
  chromeManager,
  ChromeNotFoundError,
  ChromePageError,
} from '~/manager/chrome-manager'
import { i18n } from '~/utils/i18n'

type ExtractOk = {
  ok: true
  data: {
    url: string
    title: string | null
    byline: string | null
    siteName: string | null
    lang: string | null
    dir: string | null
    publishedTime: string | null
    excerpt: string | null
    textContent: string | null
    length: number | null

    probablyReaderable: boolean
  }
}

type ExtractErr = {
  ok: false
  error: string
}

const logger = getLogger('ai.webExtract')
export const extractReadableFromUrl = async (
  url: string,
  timeoutMs?: number,
): Promise<ExtractOk | ExtractErr> => {
  const maxWait = Math.min(Math.max(timeoutMs ?? 12000, 3000), 60000)

  let page: import('puppeteer-core').Page | null = null

  try {
    page = await chromeManager.newPage()

    // Hint locale to the site
    const locale = i18n.language || 'en-US'
    await page.setExtraHTTPHeaders({ 'Accept-Language': locale })

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: maxWait })

    // Try to let client-side rendering complete
    const deadline = Date.now() + maxWait
    try {
      const remain1 = Math.max(deadline - Date.now(), 0)
      if (remain1 > 0) {
        await page.waitForFunction(() => document.readyState === 'complete', {
          timeout: remain1,
        })
      }
    } catch {
      /* ignore */
    }

    try {
      // Give a short idle window for late network activity
      const remain2 = Math.max(deadline - Date.now(), 0)
      if (remain2 > 0) {
        const settle = Math.min(remain2, 800)
        await new Promise<void>((resolve) => setTimeout(resolve, settle))
      }
    } catch {
      /* ignore */
    }

    // Serialize current DOM after scripts have potentially modified it
    const html = await page.content()
    const currentUrl = page.url() || url

    // Build a jsdom document with proper URL for absolute link resolution
    const dom = parseHTML(html, {
      url: currentUrl,
      contentType: 'text/html',
      // Keep scripts disabled in jsdom for safety
      runScripts: undefined,
      resources: undefined,
    })

    const doc = dom.window.document
    const probably = isProbablyReaderable(doc, {})
    const reader = new Readability(doc, {
      // Keep default settings; allow siteName/byline extraction
      debug: false,
    })

    const article = reader.parse()
    if (!article) {
      logger.warn(`Readability failed to parse`, { url: currentUrl })
      return { ok: false, error: 'ai.webExtract.parseFailed' }
    }

    const data = {
      url: currentUrl,
      title: article.title || null,
      byline: article.byline || null,
      siteName: article.siteName || null,
      lang: article.lang || null,
      dir: article.dir || null,
      publishedTime: article.publishedTime || null,
      excerpt: article.excerpt || null,
      textContent: article.textContent || null,
      length: typeof article.length === 'number' ? article.length : null,

      probablyReaderable: !!probably,
    }

    logger.info('web extract result', { data })

    return {
      ok: true,
      data,
    }
  } catch (error) {
    logger.error(`extraction failed`, { url, error })
    if (error instanceof ChromeNotFoundError) {
      return { ok: false, error: 'ai.webExtract.chromeNotFound' }
    }
    if (error instanceof ChromeLaunchError) {
      return { ok: false, error: 'ai.webExtract.chromeLaunchFailed' }
    }
    if (error instanceof ChromePageError) {
      return { ok: false, error: 'ai.webExtract.chromePageFailed' }
    }
    const isTimeout = error instanceof Error && error.name === 'TimeoutError'
    if (isTimeout) {
      return { ok: false, error: 'ai.webExtract.timeout' }
    }
    return { ok: false, error: 'ai.webExtract.navigationFailed' }
  } finally {
    if (page) {
      try {
        if (!page.isClosed()) {
          await page.close()
        }
      } catch (closeError) {
        logger.warn('failed to close extraction tab', { closeError })
      }
    }
  }
}
