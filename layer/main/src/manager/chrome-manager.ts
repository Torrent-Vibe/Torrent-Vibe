import { existsSync, promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { app } from 'electron'
import type { Browser, Page } from 'puppeteer-core'
import puppeteer from 'puppeteer-core'

import { getLogger } from '~/config/log-config'
import { isDevelopment } from '~/constants'
import { AppSettingsStore } from '~/services/app-settings-store'

export class ChromeNotFoundError extends Error {}
export class ChromeLaunchError extends Error {}
export class ChromePageError extends Error {}

const appSettingsStore = AppSettingsStore.getInstance()

export const HEADLESS_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const ensureAppReady = async () => {
  if (!app.isReady()) {
    await app.whenReady()
  }
}

const findChromeExecutable = (
  preferredCandidates: Array<string | null | undefined> = [],
): string | null => {
  const candidates = new Set<string>()

  for (const candidate of preferredCandidates) {
    const trimmed = candidate?.trim()
    if (trimmed) {
      candidates.add(trimmed)
    }
  }

  const { platform } = process
  const home = homedir()

  if (platform === 'darwin') {
    candidates.add(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    )
    candidates.add(
      '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
    )
    candidates.add('/Applications/Chromium.app/Contents/MacOS/Chromium')
    candidates.add(
      join(home, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    )
  } else if (platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] as
      | string
      | undefined
    const localAppData = process.env.LOCALAPPDATA

    if (programFiles)
      candidates.add(join(programFiles, 'Google/Chrome/Application/chrome.exe'))
    if (programFilesX86)
      candidates.add(
        join(programFilesX86, 'Google/Chrome/Application/chrome.exe'),
      )
    if (localAppData)
      candidates.add(join(localAppData, 'Google/Chrome/Application/chrome.exe'))
  } else {
    const binNames = [
      'google-chrome-stable',
      'google-chrome',
      'chromium-browser',
      'chromium',
      'chrome',
    ]
    const pathEntries = process.env.PATH?.split(':') ?? []
    for (const entry of pathEntries) {
      for (const name of binNames) {
        candidates.add(join(entry, name))
      }
    }
    candidates.add('/usr/bin/google-chrome-stable')
    candidates.add('/usr/bin/google-chrome')
    candidates.add('/usr/bin/chromium-browser')
    candidates.add('/usr/bin/chromium')
    candidates.add('/snap/bin/chromium')
  }

  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      if (existsSync(candidate)) return candidate
    } catch {
      /* empty */
    }
  }

  return null
}

export const detectChromeExecutable = () => findChromeExecutable()

export class ChromeManager {
  private static instance: ChromeManager | null = null
  private readonly logger = getLogger('[ai.chrome]')

  static getInstance(): ChromeManager {
    if (!this.instance) {
      this.instance = new ChromeManager()
    }
    return this.instance
  }

  private headlessBrowserPromise: Promise<Browser> | null = null
  private headlessBrowser: Browser | null = null
  private interactiveBrowserPromise: Promise<Browser> | null = null
  private interactiveBrowser: Browser | null = null
  private userDataDir: string | null = null
  private executablePath: string | null = null

  private constructor() {
    app.on('before-quit', () => {
      void this.dispose()
    })
  }

  async getExecutablePath(): Promise<string> {
    if (this.executablePath) return this.executablePath
    const configured = appSettingsStore.getChromeExecutablePath()
    const executablePath = findChromeExecutable([configured])
    if (!executablePath) {
      throw new ChromeNotFoundError(
        'Unable to locate a Chrome executable. Install Google Chrome or configure the Chrome path in Settings > App Preferences.',
      )
    }
    this.executablePath = executablePath
    return executablePath
  }

  async getUserDataDirectory(): Promise<string> {
    if (this.userDataDir) return this.userDataDir
    await ensureAppReady()
    const dir = join(app.getPath('userData'), 'chrome-search-profile')
    await fs.mkdir(dir, { recursive: true })
    this.userDataDir = dir
    return dir
  }

  private async launchHeadless(): Promise<Browser> {
    const executablePath = await this.getExecutablePath()
    const userDataDir = await this.getUserDataDirectory()
    try {
      const browser = await puppeteer.launch({
        executablePath,
        headless: isDevelopment ? false : 'shell',
        userDataDir,
        args: [
          '--no-default-browser-check',
          '--no-first-run',
          '--disable-background-networking',
          '--disable-component-update',
          '--disable-popup-blocking',
          '--disable-renderer-backgrounding',
          '--disable-sync',
          '--metrics-recording-only',
          '--mute-audio',
          '--disable-features=AutomationControlled,TranslateUI,OptimizationHints',
          '--window-size=800,800',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
      })

      return browser
    } catch (error) {
      this.logger.error('failed to launch headless Chrome', error)
      throw new ChromeLaunchError('Failed to launch Chrome for search')
    }
  }

  private async launchInteractive(): Promise<Browser> {
    const executablePath = await this.getExecutablePath()
    const userDataDir = await this.getUserDataDirectory()

    try {
      const browser = await puppeteer.launch({
        executablePath,
        headless: false,
        userDataDir,
        args: [
          '--no-default-browser-check',
          '--no-first-run',
          '--disable-background-networking',
          '--disable-component-update',
          '--disable-popup-blocking',
          '--disable-renderer-backgrounding',
          '--disable-sync',
          '--metrics-recording-only',
          '--disable-features=AutomationControlled,TranslateUI,OptimizationHints',
          '--window-size=800,800',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
      })

      return browser
    } catch (error) {
      this.logger.error('failed to launch interactive Chrome', error)
      throw new ChromeLaunchError(
        'Failed to launch Chrome for interactive solve',
      )
    }
  }

  private async ensureHeadlessBrowser(): Promise<Browser> {
    if (this.headlessBrowser && this.headlessBrowser.isConnected()) {
      return this.headlessBrowser
    }
    if (!this.headlessBrowserPromise) {
      this.headlessBrowserPromise = this.launchHeadless()
        .then((browser) => {
          this.headlessBrowser = browser
          browser.on('disconnected', () => {
            this.headlessBrowser = null
            this.headlessBrowserPromise = null
          })
          return browser
        })
        .catch((error) => {
          this.headlessBrowserPromise = null
          throw error
        })
    }
    return this.headlessBrowserPromise
  }

  async newPage(): Promise<Page> {
    const browser = await this.ensureHeadlessBrowser()
    try {
      // Reuse the initial about:blank page when possible to avoid extra tabs
      const pages = await browser.pages()
      const candidate = pages.find(
        (p) => !p.isClosed() && p.url() === 'about:blank',
      )
      const page = candidate ?? (await browser.newPage())
      await page.setUserAgent({
        userAgent: HEADLESS_USER_AGENT,
      })
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => {},
        })
      })
      return page
    } catch (error) {
      this.logger.error('failed to open tab', error)
      throw new ChromePageError('Failed to create Chrome tab for search')
    }
  }

  async ensureInteractiveBrowser(): Promise<Browser> {
    // Chrome profile cannot be opened by two browser instances concurrently
    // Callers should ensure headless is not running when using interactive
    if (this.interactiveBrowser && this.interactiveBrowser.connected) {
      return this.interactiveBrowser
    }
    if (!this.interactiveBrowserPromise) {
      this.interactiveBrowserPromise = this.launchInteractive()
        .then((browser) => {
          this.interactiveBrowser = browser
          browser.on('disconnected', () => {
            this.interactiveBrowser = null
            this.interactiveBrowserPromise = null
          })
          return browser
        })
        .catch((error) => {
          this.interactiveBrowserPromise = null
          throw error
        })
    }
    return this.interactiveBrowserPromise
  }

  async newInteractivePage(): Promise<Page> {
    const browser = await this.ensureInteractiveBrowser()
    try {
      const pages = await browser.pages()
      const candidate = pages.find(
        (p) => !p.isClosed() && p.url() === 'about:blank',
      )
      const page = candidate ?? (await browser.newPage())
      await page.setUserAgent({
        userAgent: HEADLESS_USER_AGENT,
      })
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => {},
        })
      })
      return page
    } catch (error) {
      this.logger.error('failed to open interactive tab', error)
      throw new ChromePageError(
        'Failed to create Chrome tab for interactive solve',
      )
    }
  }

  async closeHeadless(): Promise<void> {
    if (this.headlessBrowser) {
      try {
        await this.headlessBrowser.close()
        this.headlessBrowser.process()?.kill()
      } catch (error) {
        this.logger.warn('failed to close headless Chrome cleanly', error)
      } finally {
        this.headlessBrowser = null
        this.headlessBrowserPromise = null
      }
    }
  }

  async closeInteractive(): Promise<void> {
    if (this.interactiveBrowser) {
      try {
        await this.interactiveBrowser.close()
      } catch (error) {
        this.logger.warn('failed to close interactive Chrome cleanly', error)
      } finally {
        this.interactiveBrowser = null
        this.interactiveBrowserPromise = null
      }
    }
  }

  async dispose(): Promise<void> {
    await this.closeHeadless()
    await this.closeInteractive()
  }
}

export const chromeManager = ChromeManager.getInstance()
