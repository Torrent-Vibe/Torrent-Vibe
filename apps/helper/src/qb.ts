export interface QbTorrent {
  hash: string
  name: string
  progress: number
  state: string
  category?: string
  tags?: string
}

export interface QbFile {
  name: string
  size: number
}

export interface AddTorrentRequest {
  urls: string
  savepath: string
  category: string
  tags: string
  rename: string
}

export interface QbClient {
  listTorrents: () => Promise<QbTorrent[]>
  addTorrent: (request: AddTorrentRequest) => Promise<{ hash: string }>
  listFiles: (hash: string) => Promise<QbFile[]>
  renameFile: (hash: string, oldPath: string, newPath: string) => Promise<void>
}

export function extractTorrentInfohash(url: string): string | undefined {
  const match = url.match(/([a-fA-F0-9]{40})(?:\.torrent)?(?:[?#]|$)/)
  return match?.[1]?.toLowerCase()
}

export function createQbClient(options: {
  baseUrl: string
  username: string
  password: string
  fetch?: typeof fetch
}): QbClient {
  const fetchFn = options.fetch ?? fetch
  const base = options.baseUrl.replace(/\/$/, '')
  let cookie = ''

  async function login() {
    const response = await fetchFn(`${base}/api/v2/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: options.username,
        password: options.password,
      }),
    })
    const header
      = typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie') ?? '']
    const sid = header
      .flatMap(value => value.split(/,(?=[^;]+=)/))
      .map(value => /(?:^|;\s*)SID=([^;]+)/i.exec(value)?.[1])
      .find(Boolean)
    if (!response.ok || !sid) {
      throw new Error('qBittorrent login failed')
    }
    cookie = `SID=${sid}`
  }

  async function request(
    path: string,
    init: RequestInit = {},
    retry = true,
  ): Promise<Response> {
    if (!cookie) {
      await login()
    }
    const headers = new Headers(init.headers)
    headers.set('cookie', cookie)
    const response = await fetchFn(`${base}${path}`, { ...init, headers })
    if (response.status === 403 && retry) {
      cookie = ''
      return request(path, init, false)
    }
    return response
  }

  async function listTorrents(): Promise<QbTorrent[]> {
    const response = await request('/api/v2/torrents/info')
    if (!response.ok) {
      throw new Error(`qBittorrent list failed: ${response.status}`)
    }
    const payload = (await response.json()) as Array<{
      hash: string
      name: string
      progress: number
      state: string
      category?: string
      tags?: string
    }>
    return payload.map(item => ({
      hash: item.hash.toLowerCase(),
      name: item.name,
      progress: item.progress,
      state: item.state,
      category: item.category,
      tags: item.tags,
    }))
  }

  return {
    listTorrents,
    async addTorrent(add) {
      const form = new FormData()
      form.append('urls', add.urls)
      form.append('savepath', add.savepath)
      form.append('category', add.category)
      form.append('tags', add.tags)
      form.append('rename', add.rename)
      form.append('autoTMM', 'false')
      const response = await request('/api/v2/torrents/add', {
        method: 'POST',
        body: form,
      })
      if (!response.ok) {
        throw new Error(`qBittorrent add failed: ${response.status}`)
      }
      const fromUrl = extractTorrentInfohash(add.urls)
      if (fromUrl) {
        return { hash: fromUrl }
      }
      const torrents = await listTorrents()
      const match = torrents.find(
        item =>
          item.name === add.rename && (item.tags ?? '').includes(add.tags),
      )
      if (!match) {
        throw new Error('qBittorrent add succeeded but hash is unknown')
      }
      return { hash: match.hash }
    },
    async listFiles(hash) {
      const response = await request(
        `/api/v2/torrents/files?hash=${encodeURIComponent(hash)}`,
      )
      if (!response.ok) {
        throw new Error(`qBittorrent files failed: ${response.status}`)
      }
      const payload = (await response.json()) as Array<{
        name: string
        size: number
      }>
      return payload.map(item => ({ name: item.name, size: item.size }))
    },
    async renameFile(hash, oldPath, newPath) {
      const response = await request('/api/v2/torrents/renameFile', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ hash, oldPath, newPath }),
      })
      if (!response.ok) {
        throw new Error(`qBittorrent rename failed: ${response.status}`)
      }
    },
  }
}
