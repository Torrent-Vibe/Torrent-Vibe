import { QBittorrent } from '@innei/qbittorrent-browser'

import type {
  AddTorrentOptions,
  MainData,
  QBittorrentConfig,
  TorrentFile,
  TorrentFilters,
  TorrentPeer,
  TorrentProperties,
  TorrentTracker,
  TransferInfo,
} from './types'

const MAGNET_BTih_PREFIX = 'urn:btih:'
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const base32ToHex = (value: string): string => {
  let bits = ''
  for (const char of value.toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) throw new Error('Invalid base32 character in magnet hash')
    bits += index.toString(2).padStart(5, '0')
  }

  let hex = ''
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    hex += Number.parseInt(bits.slice(i, i + 4), 2).toString(16)
  }

  return hex.slice(0, 40)
}

const normalizeInfoHash = (value: string): string => {
  const trimmed = value.replace(/=+$/u, '').trim()
  if (trimmed.length === 40) return trimmed.toUpperCase()
  if (trimmed.length === 32) {
    try {
      return base32ToHex(trimmed).toUpperCase()
    } catch {
      return trimmed.toUpperCase()
    }
  }
  return trimmed.toUpperCase()
}

const extractMagnetMetadata = (
  magnetUrl: string,
): { infoHash: string; displayName?: string } | null => {
  try {
    const parsed = new URL(magnetUrl)
    if (parsed.protocol !== 'magnet:') return null

    const xtParams = parsed.searchParams.getAll('xt')
    const infoHashValue = xtParams
      .map((value) => value.trim())
      .find((value) => value.toLowerCase().startsWith(MAGNET_BTih_PREFIX))

    if (!infoHashValue) return null

    const hash = normalizeInfoHash(
      infoHashValue.slice(MAGNET_BTih_PREFIX.length),
    )
    const displayName = parsed.searchParams.get('dn') ?? undefined

    return { infoHash: hash, displayName }
  } catch {
    return null
  }
}

export class QBittorrentClient extends QBittorrent {
  public static shared = new QBittorrentClient({
    host: '127.0.0.1',
    port: 8080,
    username: '',
    password: '',
    useHttps: false,
  })

  public static configure(config: QBittorrentConfig) {
    QBittorrentClient.shared = new QBittorrentClient(config)
  }

  public static create(config: QBittorrentConfig) {
    return new QBittorrentClient(config)
  }

  public static clone() {
    return new QBittorrentClient(QBittorrentClient.shared.ownConfig)
  }

  private constructor(private ownConfig: QBittorrentConfig) {
    let baseUrl: string

    if (ownConfig.baseUrl) {
      if (ownConfig.baseUrl.startsWith('/')) {
        baseUrl = `${globalThis.location.origin}${ownConfig.baseUrl}`
      } else {
        baseUrl = ownConfig.baseUrl
      }
      baseUrl = baseUrl.replace(/\/$/, '')
    } else {
      baseUrl = `${ownConfig.useHttps ? 'https' : 'http'}://${ownConfig.host}:${ownConfig.port}`
    }

    super({
      ...ownConfig,
      baseUrl,
    })
  }

  async requestMainData(rid = 0): Promise<MainData> {
    return this.request<MainData>('/sync/maindata', 'GET', {
      rid: rid.toString(),
    })
  }

  async requestTransferInfo(): Promise<TransferInfo> {
    return this.request<TransferInfo>('/transfer/info', 'GET')
  }

  async requestTorrentsInfo(filters?: TorrentFilters): Promise<any[]> {
    const params: Record<string, string> = {}
    if (filters?.filter) params.filter = filters.filter
    if (filters?.category) params.category = filters.category
    if (filters?.tag) params.tag = filters.tag
    if (filters?.sort) params.sort = filters.sort
    if (filters?.reverse !== undefined) params.reverse = String(filters.reverse)
    if (filters?.limit !== undefined) params.limit = String(filters.limit)
    if (filters?.offset !== undefined) params.offset = String(filters.offset)
    if (filters?.hashes) {
      params.hashes = Array.isArray(filters.hashes)
        ? filters.hashes.join('|')
        : filters.hashes
    }
    return this.request<any[]>('/torrents/info', 'GET', params)
  }

  async requestTorrentFiles(hash: string): Promise<TorrentFile[]> {
    return this.request<TorrentFile[]>('/torrents/files', 'GET', { hash })
  }

  async requestTorrentPeers(
    hash: string,
    rid?: number,
  ): Promise<{ peers: Record<string, TorrentPeer>; show_flags: boolean }> {
    const params: Record<string, string> = { hash }
    if (rid !== undefined) params.rid = rid.toString()
    return this.request('/sync/torrentPeers', 'GET', params)
  }

  async requestTorrentTrackers(hash: string): Promise<TorrentTracker[]> {
    return this.request<TorrentTracker[]>('/torrents/trackers', 'GET', { hash })
  }

  async requestTorrentPieceStates(hash: string): Promise<number[]> {
    return this.request<number[]>('/torrents/pieceStates', 'GET', { hash })
  }

  async requestTorrentProperties(hash: string): Promise<TorrentProperties> {
    return this.request<TorrentProperties>('/torrents/properties', 'GET', {
      hash,
    })
  }

  async requestCategories(): Promise<
    Record<string, { name: string; savePath: string }>
  > {
    return this.getCategories()
  }

  async requestTags(): Promise<string[]> {
    return this.getTags()
  }

  async requestSetSuperSeeding(
    hashes: string | string[],
    value: boolean,
  ): Promise<boolean> {
    const hashString = Array.isArray(hashes) ? hashes.join('|') : hashes
    const formData = new URLSearchParams()
    formData.append('hashes', hashString)
    formData.append('value', value.toString())
    return this.request(
      '/torrents/setSuperSeeding',
      'POST',
      undefined,
      formData,
    )
  }

  async requestSetShareLimits(
    hashes: string | string[],
    ratioLimit?: number,
    seedingTimeLimit?: number,
    inactiveSeedingTimeLimit?: number,
  ): Promise<boolean> {
    const hashString = Array.isArray(hashes) ? hashes.join('|') : hashes
    const formData = new URLSearchParams()
    formData.append('hashes', hashString)
    if (ratioLimit !== undefined)
      formData.append('ratioLimit', ratioLimit.toString())
    if (seedingTimeLimit !== undefined)
      formData.append('seedingTimeLimit', seedingTimeLimit.toString())
    if (inactiveSeedingTimeLimit !== undefined)
      formData.append(
        'inactiveSeedingTimeLimit',
        inactiveSeedingTimeLimit.toString(),
      )
    return this.request('/torrents/setShareLimits', 'POST', undefined, formData)
  }

  async requestSetAutoManagement(
    hashes: string | string[],
    enable: boolean,
  ): Promise<boolean> {
    const hashString = Array.isArray(hashes) ? hashes.join('|') : hashes
    const formData = new URLSearchParams()
    formData.append('hashes', hashString)
    formData.append('enable', enable.toString())
    return this.request(
      '/torrents/setAutoManagement',
      'POST',
      undefined,
      formData,
    )
  }

  async requestSetForceStart(
    hashes: string | string[],
    value: boolean,
  ): Promise<boolean> {
    const hashString = Array.isArray(hashes) ? hashes.join('|') : hashes
    const formData = new URLSearchParams()
    formData.append('hashes', hashString)
    formData.append('value', value.toString())
    return this.request('/torrents/setForceStart', 'POST', undefined, formData)
  }

  async requestSetFilePriority(
    hash: string,
    fileIds: number[] | string,
    priority: 0 | 1 | 6 | 7,
  ): Promise<boolean> {
    const idString = Array.isArray(fileIds) ? fileIds.join('|') : fileIds
    const formData = new URLSearchParams()
    formData.append('hash', hash)
    formData.append('id', idString)
    formData.append('priority', priority.toString())
    return this.request('/torrents/filePrio', 'POST', undefined, formData)
  }

  async requestToggleSequentialDownload(
    hashes: string | string[],
  ): Promise<boolean> {
    const hashString = Array.isArray(hashes) ? hashes.join('|') : hashes
    const formData = new URLSearchParams()
    formData.append('hashes', hashString)
    return this.request(
      '/torrents/toggleSequentialDownload',
      'POST',
      undefined,
      formData,
    )
  }

  async requestToggleFirstLastPiecePriority(
    hashes: string | string[],
  ): Promise<boolean> {
    const hashString = Array.isArray(hashes) ? hashes.join('|') : hashes
    const formData = new URLSearchParams()
    formData.append('hashes', hashString)
    return this.request(
      '/torrents/toggleFirstLastPiecePrio',
      'POST',
      undefined,
      formData,
    )
  }

  async requestRecheckTorrents(hashes: string | string[]): Promise<boolean> {
    const hashString = Array.isArray(hashes) ? hashes.join('|') : hashes
    const formData = new URLSearchParams()
    formData.append('hashes', hashString)
    return this.request('/torrents/recheck', 'POST', undefined, formData)
  }

  async requestReannounceTorrents(hashes: string | string[]): Promise<boolean> {
    const hashString = Array.isArray(hashes) ? hashes.join('|') : hashes
    const formData = new URLSearchParams()
    formData.append('hashes', hashString)
    return this.request('/torrents/reannounce', 'POST', undefined, formData)
  }

  async requestAddTrackers(hash: string, urls: string): Promise<boolean> {
    const formData = new URLSearchParams()
    formData.append('hash', hash)
    formData.append('urls', urls)
    return this.request('/torrents/addTrackers', 'POST', undefined, formData)
  }

  async requestEditTrackers(
    hash: string,
    origUrl: string,
    newUrl: string,
  ): Promise<boolean> {
    const formData = new URLSearchParams()
    formData.append('hash', hash)
    formData.append('origUrl', origUrl)
    formData.append('newUrl', newUrl)
    return this.request('/torrents/editTrackers', 'POST', undefined, formData)
  }

  async requestRemoveTrackers(hash: string, urls: string): Promise<boolean> {
    const formData = new URLSearchParams()
    formData.append('hash', hash)
    formData.append('urls', urls)
    return this.request('/torrents/removeTrackers', 'POST', undefined, formData)
  }

  async requestRenameFile(
    hash: string,
    oldPath: string,
    newPath: string,
  ): Promise<boolean> {
    const formData = new URLSearchParams()
    formData.append('hash', hash)
    formData.append('oldPath', oldPath)
    formData.append('newPath', newPath)
    return this.request('/torrents/renameFile', 'POST', undefined, formData)
  }

  async requestRenameFolder(
    hash: string,
    oldPath: string,
    newPath: string,
  ): Promise<boolean> {
    const formData = new URLSearchParams()
    formData.append('hash', hash)
    formData.append('oldPath', oldPath)
    formData.append('newPath', newPath)
    return this.request('/torrents/renameFolder', 'POST', undefined, formData)
  }

  async requestBanPeers(peers: string[]): Promise<boolean> {
    const formData = new URLSearchParams()
    formData.append('peers', peers.join('|'))
    return this.request('/transfer/banPeers', 'POST', undefined, formData)
  }

  async requestToggleAlternativeSpeedLimits(): Promise<boolean> {
    return this.request('/transfer/toggleSpeedLimitsMode', 'POST')
  }

  async previewMagnet(
    magnetUrl: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {},
  ): Promise<{
    hash: string
    name: string
    files: TorrentFile[]
    existed: boolean
    displayName?: string
  }> {
    const metadata = extractMagnetMetadata(magnetUrl)
    if (!metadata) {
      throw new Error('Invalid magnet link: missing BitTorrent info hash')
    }

    const hash = metadata.infoHash.toUpperCase()
    const timeoutMs = options.timeoutMs ?? 30000
    const pollIntervalMs = options.pollIntervalMs ?? 1000

    let existed = false
    const existing = await this.requestTorrentsInfo({ hashes: hash })
    if (existing && existing.length > 0) {
      existed = true
    }

    if (!existed) {
      try {
        await this.requestAddTorrent({ urls: magnetUrl, stopped: true })
      } catch (error) {
        const verifyExisting = await this.requestTorrentsInfo({ hashes: hash })
        if (!verifyExisting || verifyExisting.length === 0) {
          throw error
        }
        existed = true
      }
    }

    const deadline = Date.now() + timeoutMs
    let lastError: unknown

    while (Date.now() < deadline) {
      try {
        const [info] = await this.requestTorrentsInfo({ hashes: hash })
        if (info) {
          existed = true
          try {
            const files = await this.requestTorrentFiles(hash)
            if (files.length > 0) {
              return {
                hash,
                name: info.name || metadata.displayName || hash,
                files,
                existed,
                displayName: metadata.displayName,
              }
            }
          } catch (error) {
            lastError = error
          }
        }
      } catch (error) {
        lastError = error
      }

      await sleep(pollIntervalMs)
    }

    const timeoutError = new Error('Timed out fetching magnet metadata')
    if (lastError) {
      ;(timeoutError as any).cause = lastError
    }
    throw timeoutError
  }

  async requestAddTorrent(options: AddTorrentOptions): Promise<boolean> {
    const formData = new FormData()
    if (options.urls) formData.append('urls', options.urls)
    if (options.torrents && options.torrents.length > 0) {
      options.torrents.forEach((torrent) =>
        formData.append('torrents', torrent),
      )
    }
    if (options.savepath) formData.append('savepath', options.savepath)
    if (options.cookie) formData.append('cookie', options.cookie)
    if (options.category) formData.append('category', options.category)
    if (options.tags) formData.append('tags', options.tags)
    if (options.rename) formData.append('rename', options.rename)
    if (options.skip_checking !== undefined)
      formData.append('skip_checking', options.skip_checking.toString())
    if (options.stopped !== undefined) {
      formData.append('stopped', options.stopped.toString())
      // For compatibility with older versions of QBittorrent
      formData.append('paused', options.stopped.toString())
    }
    if (options.root_folder !== undefined && options.root_folder)
      formData.append('contentLayout', 'Subfolder')
    if (options.autoTMM !== undefined)
      formData.append('autoTMM', options.autoTMM.toString())
    if (options.sequentialDownload !== undefined)
      formData.append(
        'sequentialDownload',
        options.sequentialDownload.toString(),
      )
    if (options.firstLastPiecePrio !== undefined)
      formData.append(
        'firstLastPiecePrio',
        options.firstLastPiecePrio.toString(),
      )
    if (options.upLimit !== undefined)
      formData.append('upLimit', options.upLimit.toString())
    if (options.dlLimit !== undefined)
      formData.append('dlLimit', options.dlLimit.toString())
    if (options.ratioLimit !== undefined)
      formData.append('ratioLimit', options.ratioLimit.toString())
    if (options.seedingTimeLimit !== undefined)
      formData.append('seedingTimeLimit', options.seedingTimeLimit.toString())

    return this.request('/torrents/add', 'POST', undefined, formData)
  }
}
