import { session } from 'electron'

interface SessionInitOptions {
  isDevelopment: boolean
  devServerHost: string
  devServerPort: number
}

export class SessionManager {
  public static instance: SessionManager = new SessionManager()
  private initialized = false
  private options: SessionInitOptions | null = null
  private boundSessions = new WeakSet<Electron.Session>()

  private constructor() {}

  initialize(options: SessionInitOptions): void {
    if (this.initialized) return
    this.initialized = true
    this.options = options

    const getAppOrigin = (): string => {
      if (options.isDevelopment) {
        return `http://${options.devServerHost}:${options.devServerPort}`
      }
      return 'app://'
    }

    // Keep current behavior: bind to defaultSession once at bootstrap.
    this.bindSession(session.defaultSession)

    console.info(
      'Session configured to disable CORS restrictions with app origin:',
      getAppOrigin(),
    )
  }

  /**
   * Bind request / response interceptors to a specific Electron session.
   * This is important when windows use non-default sessions (e.g. partition).
   */
  bindSession(targetSession: Electron.Session): void {
    if (!this.options) {
      throw new Error('SessionManager must be initialized before binding.')
    }
    if (this.boundSessions.has(targetSession)) return
    this.boundSessions.add(targetSession)

    const { isDevelopment, devServerHost, devServerPort } = this.options
    const getAppOrigin = (): string => {
      if (isDevelopment) {
        return `http://${devServerHost}:${devServerPort}`
      }
      return 'app://'
    }

    targetSession.webRequest.onBeforeSendHeaders(async (details, callback) => {
      await this.attachSIDCookie(targetSession, details)
      callback({ requestHeaders: details.requestHeaders })
    })

    targetSession.webRequest.onHeadersReceived(async (details, callback) => {
      const appOrigin = getAppOrigin()

      const responseHeaders: Record<string, string[]> = {
        ...details.responseHeaders,
      }

      const setHeader = (name: string, value: string) => {
        const lower = name.toLowerCase()
        for (const key of Object.keys(responseHeaders)) {
          if (key.toLowerCase() === lower) delete responseHeaders[key]
        }
        responseHeaders[name] = [value]
      }

      setHeader('Access-Control-Allow-Origin', appOrigin)
      setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      )
      setHeader('Access-Control-Allow-Headers', '*')
      setHeader('Access-Control-Allow-Credentials', 'true')
      setHeader('Access-Control-Expose-Headers', '*')

      const setCookieKey = Object.keys(responseHeaders).find(
        (k) => k.toLowerCase() === 'set-cookie',
      )
      if (setCookieKey) {
        for (const cookieHeader of responseHeaders[setCookieKey]) {
          await this.setCookieFromHeader(
            targetSession,
            details.url,
            cookieHeader,
          )
        }
      }

      callback({ responseHeaders })
    })
  }

  private async attachSIDCookie(
    targetSession: Electron.Session,
    details: Electron.OnBeforeSendHeadersListenerDetails,
  ): Promise<void> {
    try {
      if (!this.isQBittorrentRequest(details.url)) return

      const cookies = await targetSession.cookies.get({
        url: details.url,
        name: 'SID',
      })
      if (cookies.length > 0) {
        const sidCookie = cookies[0]
        const cookieHeader = `SID=${sidCookie.value}`
        if (details.requestHeaders['Cookie']) {
          details.requestHeaders['Cookie'] += `; ${cookieHeader}`
        } else {
          details.requestHeaders['Cookie'] = cookieHeader
        }
      } else {
        console.info('No SID cookie found for request:', details.url)
      }
    } catch (error) {
      console.error('Failed to attach SID cookie:', error)
    }
  }

  private isQBittorrentRequest(url: string): boolean {
    try {
      const urlObj = new URL(url)
      const path = urlObj.pathname.toLowerCase()
      if (path.includes('/auth/login')) return false
      return path.startsWith('/api/v2/')
    } catch {
      return false
    }
  }

  private async setCookieFromHeader(
    targetSession: Electron.Session,
    url: string,
    cookieHeader: string,
  ): Promise<void> {
    try {
      const parts = cookieHeader.split(';').map((part) => part.trim())
      const [nameValue] = parts
      const [name, value] = nameValue.split('=', 2)
      if (!name || value === undefined) {
        console.warn('Invalid cookie header format:', cookieHeader)
        return
      }

      const urlObj = new URL(url)
      const domain = urlObj.hostname
      const isHttps = urlObj.protocol === 'https:'
      const expirationDate =
        name === 'SID'
          ? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
          : undefined
      const sameSitePolicy: 'no_restriction' | 'lax' = isHttps
        ? 'no_restriction'
        : 'lax'
      const secureFlag = isHttps

      const cookieDetails: Electron.CookiesSetDetails = {
        url,
        name,
        value,
        domain,
        path: '/',
        secure: secureFlag,
        httpOnly: false,
        sameSite: sameSitePolicy,
        expirationDate,
      }

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i].toLowerCase()
        if (part.startsWith('path=')) {
          cookieDetails.path = part.slice(5)
        } else if (part.startsWith('domain=')) {
          cookieDetails.domain = part.slice(7)
        } else if (part === 'httponly') {
          cookieDetails.httpOnly = true
        } else if (part === 'secure') {
          cookieDetails.secure = true
        }
      }

      await targetSession.cookies
        .set(cookieDetails)
        .then(() => {
          if (name === 'SID') {
            targetSession.cookies
              .get({ url, name: 'SID' })
              .then((cookies) => {
                console.info(
                  'Verification: SID cookie in session:',
                  cookies.length > 0 ? cookies[0] : 'Not found',
                )
              })
              .catch((err) =>
                console.error('Failed to verify SID cookie:', err),
              )
          }
        })
        .catch((error) => {
          console.error('Failed to set cookie:', error)
        })
    } catch (error) {
      console.error('Error parsing and setting cookie:', error)
    }
  }
}
