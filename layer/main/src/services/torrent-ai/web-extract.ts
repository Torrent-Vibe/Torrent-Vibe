import { isProbablyReaderable, Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

import { getLogger } from '~/config/log-config'
import {
  AgentBrowserError,
  agentBrowserManager,
  AgentBrowserNotFoundError,
  HEADLESS_USER_AGENT,
} from '~/manager/agent-browser-manager'

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

  try {
    return await agentBrowserManager.run(async (browser) => {
      await browser.open(url, {
        userAgent: HEADLESS_USER_AGENT,
        timeoutMs: maxWait,
      })

      await browser.waitForLoad('networkidle', Math.min(maxWait, 8000))

      const html = await browser.evaluate<string>(
        'document.documentElement.outerHTML',
      )
      const currentUrl = (await browser.getCurrentUrl()) || url

      if (!html) {
        logger.warn('extraction returned empty html', { url: currentUrl })
        return { ok: false, error: 'ai.webExtract.parseFailed' }
      }

      // Build a jsdom-like document with proper URL for absolute link resolution
      const dom = parseHTML(html, {
        url: currentUrl,
        contentType: 'text/html',
        // Keep scripts disabled for safety
        runScripts: undefined,
        resources: undefined,
      })

      const doc = dom.window.document
      const probably = isProbablyReaderable(doc, {})
      const reader = new Readability(doc, {
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
    })
  } catch (error) {
    logger.error(`extraction failed`, { url, error })
    if (error instanceof AgentBrowserNotFoundError) {
      return { ok: false, error: 'ai.webExtract.agentBrowserNotFound' }
    }
    if (error instanceof AgentBrowserError) {
      if (/timed out/i.test(error.message)) {
        return { ok: false, error: 'ai.webExtract.timeout' }
      }
      if (/navigation/i.test(error.message)) {
        return { ok: false, error: 'ai.webExtract.navigationFailed' }
      }
      return { ok: false, error: 'ai.webExtract.agentBrowserFailed' }
    }
    return { ok: false, error: 'ai.webExtract.navigationFailed' }
  }
}
