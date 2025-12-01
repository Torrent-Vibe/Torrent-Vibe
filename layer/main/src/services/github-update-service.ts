import crypto from 'node:crypto'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'

import axios from 'axios'
import log from 'electron-log'
import yaml from 'js-yaml'
import { ofetch } from 'ofetch'

import {
  REQUIRE_SHA256_FOR_DOWNLOAD,
  UPDATE_ASSET_FILENAME,
  UPDATE_SHA256_FILENAME,
} from '../config/update-config'
import { BridgeService } from './bridge-service'

interface GitHubAsset {
  name: string
  browser_download_url: string
  size: number
}

interface GitHubRelease {
  tag_name: string
  assets: GitHubAsset[]
  prerelease?: boolean
}

export interface LatestReleaseInfo {
  version: string
  assetUrl: string
  assetName: string
  manifestUrl?: string
  expectedSha256?: string
  prerelease?: boolean
}

/**
 * Downloads update packages from GitHub with support for resuming partial
 * downloads and verifying the resulting file's integrity.
 */
export class GithubUpdateService {
  private logger = log.scope('GithubUpdateService')

  constructor(private UA = 'TorrentVibe-Client') {
    this.logger.info(
      `GithubUpdateService initialized with User-Agent: ${this.UA}`,
    )

    const ghToken = process.env.GH_TOKEN
    if (ghToken) {
      this.logger.info(
        `GitHub token available (${ghToken.slice(0, 8)}...${ghToken.slice(-4)})`,
      )
      this.logger.debug(
        'GitHub API requests will be authenticated with higher rate limits',
      )
    } else {
      this.logger.warn(
        'No GitHub token (GH_TOKEN) found in environment variables',
      )
      this.logger.warn('Using unauthenticated requests - rate limits may apply')
    }
  }

  /**
   * Create headers for GitHub API requests with optional authentication
   */
  private createGitHubHeaders(
    additionalHeaders: Record<string, string> = {},
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': this.UA,
      ...additionalHeaders,
    }

    const ghToken = process.env.GH_TOKEN
    if (ghToken) {
      headers.Authorization = `Bearer ${ghToken}`
    }

    return headers
  }

  private async fetchJson<T>(url: string): Promise<T> {
    this.logger.debug(`Making JSON request to: ${url}`)
    const headers = this.createGitHubHeaders({
      Accept: 'application/vnd.github+json',
    })

    if (headers.Authorization) {
      this.logger.debug('Using authenticated GitHub API request')
    } else {
      this.logger.debug('Using unauthenticated GitHub API request')
    }

    try {
      const result = await ofetch<T>(url, {
        headers,
        onResponse: ({ response }) => {
          this.logger.debug(`Response status: ${response.status}`)

          // Log GitHub API rate limit information
          const rateLimitRemaining = response.headers.get(
            'x-ratelimit-remaining',
          )
          if (rateLimitRemaining) {
            this.logger.debug(
              `GitHub API rate limit remaining: ${rateLimitRemaining}`,
            )
          }

          // Handle rate limit exceeded
          if (response.status === 403 && rateLimitRemaining === '0') {
            const resetTime = response.headers.get('x-ratelimit-reset')
            const resetDate = resetTime
              ? new Date(Number.parseInt(resetTime, 10) * 1000)
              : 'unknown'
            this.logger.error(
              `GitHub API rate limit exceeded. Resets at: ${resetDate}`,
            )
            this.logger.error(
              'Consider setting GH_TOKEN environment variable for higher rate limits',
            )
          }
        },
      })

      this.logger.debug('Successfully fetched JSON response')
      return result
    } catch (error) {
      this.logger.error('Failed to fetch JSON:', error)
      throw error
    }
  }

  private async fetchText(url: string): Promise<string> {
    this.logger.debug(`Making text request to: ${url}`)
    const headers = this.createGitHubHeaders({
      Accept: '*/*',
    })

    if (headers.Authorization) {
      this.logger.debug('Using authenticated text request to GitHub')
    }

    try {
      if (url.startsWith('file://')) {
        const p = url.replace('file://', '')
        return readFileSync(p, 'utf8')
      }
      const result = await fetch(url, {
        headers,
      })

      const text = await result.text()

      this.logger.debug(`Text response length: ${text.length} characters`)
      return text
    } catch (error) {
      this.logger.error('Failed to fetch text:', error)
      throw error
    }
  }

  async getLatestRelease(
    owner: string,
    repo: string,
  ): Promise<LatestReleaseInfo | null> {
    this.logger.info(`Getting latest release for ${owner}/${repo}`)
    const api = `https://api.github.com/repos/${owner}/${repo}/releases/latest`
    const rel = await this.fetchJson<GitHubRelease>(api)
    this.logger.debug('Raw release data:', JSON.stringify(rel, null, 2))

    const version = rel.tag_name?.replace(/^v/, '') ?? ''
    if (!version) {
      this.logger.warn('No valid version found in release tag_name')
      return null
    }

    this.logger.info(`Found release version: ${version}`)
    this.logger.debug(`Release assets count: ${rel.assets?.length || 0}`)

    if (rel.assets) {
      rel.assets.forEach((asset, index) => {
        this.logger.debug(
          `Asset ${index}: ${asset.name} (${asset.size} bytes) - ${asset.browser_download_url}`,
        )
      })
    }

    // Prefer configured asset name; fallback to any suitable asset
    let binary: GitHubAsset | undefined = rel.assets.find(
      (a) => a.name === UPDATE_ASSET_FILENAME,
    )

    if (binary) {
      this.logger.info(`Found preferred asset: ${binary.name}`)
    } else {
      this.logger.debug(
        `Preferred asset ${UPDATE_ASSET_FILENAME} not found, searching for suitable alternatives`,
      )
      binary = rel.assets.find(
        (a) =>
          /\.(?:qupd|bin|pkg|dat)$/i.test(a.name) || /encrypted/i.test(a.name),
      )
      if (binary) {
        this.logger.info(`Found suitable asset: ${binary.name}`)
      } else {
        this.logger.debug(
          'No suitable asset found by pattern, using first available asset',
        )
        binary = rel.assets[0]
      }
    }

    if (!binary) {
      this.logger.error('No binary asset found in release')
      return null
    }

    this.logger.info(
      `Selected binary asset: ${binary.name} (${binary.size} bytes)`,
    )

    // Optional SHA256 asset
    let expectedSha256: string | undefined
    const shaAsset = rel.assets.find(
      (a) =>
        a.name === UPDATE_SHA256_FILENAME ||
        /\.(?:sha256|sha256sum|sha)$/i.test(a.name),
    )

    if (shaAsset) {
      this.logger.debug(`Found SHA256 asset: ${shaAsset.name}`)
      try {
        const text = await this.fetchText(shaAsset.browser_download_url)
        const match = text.trim().match(/^[a-f0-9]{64}/i)
        if (match) {
          expectedSha256 = match[0].toLowerCase()
          this.logger.info(`Retrieved SHA256 hash: ${expectedSha256}`)
        } else {
          this.logger.warn(
            `SHA256 asset contains invalid format: ${text.slice(0, 100)}`,
          )
        }
      } catch (error) {
        // Only SHA download failed -> continue without hash
        this.logger.warn('Failed to download SHA256 asset:', error)
      }
    } else {
      this.logger.debug('No SHA256 asset found')
    }

    // Optional manifest asset (YAML only)
    let manifestUrl: string | undefined
    const manifestAsset = rel.assets.find((a) =>
      /manifest\.ya?ml$/i.test(a.name),
    )
    if (manifestAsset) {
      this.logger.info(`Found manifest asset: ${manifestAsset.name}`)
      manifestUrl = manifestAsset.browser_download_url
    }

    const result = {
      version,
      assetUrl: binary.browser_download_url,
      assetName: binary.name,
      manifestUrl,
      expectedSha256,
      prerelease: rel.prerelease,
    }

    this.logger.info('Latest release info prepared:', result)
    return result
  }

  async downloadWithResume(url: string, dest: string, expectedHash: string) {
    this.logger.info(`Starting resumable download: ${url} -> ${dest}`)
    this.logger.debug(`Expected hash: ${expectedHash}`)

    // Ensure directory exists
    const dir = dirname(dest)
    if (!existsSync(dir)) {
      this.logger.debug(`Creating directory: ${dir}`)
      mkdirSync(dir, { recursive: true })
    }

    const start = existsSync(dest) ? statSync(dest).size : 0
    this.logger.debug(`Starting download from byte: ${start}`)

    const headers = this.createGitHubHeaders()
    if (start > 0) {
      headers.Range = `bytes=${start}-`
      this.logger.info(`Resuming download from ${start} bytes`)
    } else {
      this.logger.info('Starting fresh download')
    }

    try {
      await this.downloadFileStream(url, dest, headers, start)
    } catch (error) {
      this.logger.error('Download failed:', error)
      throw error
    }

    this.logger.info('Verifying downloaded file checksum...')
    const hash = crypto
      .createHash('sha256')
      .update(readFileSync(dest))
      .digest('hex')

    this.logger.debug(`Calculated hash: ${hash}`)
    this.logger.debug(`Expected hash:   ${expectedHash}`)

    if (REQUIRE_SHA256_FOR_DOWNLOAD && hash !== expectedHash) {
      this.logger.error(
        'Checksum mismatch detected, removing file and rethrowing error',
      )
      unlinkSync(dest)
      throw new Error('Checksum mismatch, restarting download')
    } else if (hash === expectedHash) {
      this.logger.info('Checksum verification successful')
    } else {
      this.logger.warn(
        'Checksum verification skipped (REQUIRE_SHA256_FOR_DOWNLOAD is false)',
      )
    }
  }

  private async downloadFileStream(
    url: string,
    dest: string,
    headers: Record<string, string>,
    start: number,
  ): Promise<void> {
    this.logger.debug(`Starting file stream download from: ${url}`)

    try {
      // Check if we need to resume download
      const rangeHeaders = start > 0 ? { Range: `bytes=${start}-` } : {}

      const requestHeaders = {
        ...headers,
        ...rangeHeaders,
        'User-Agent': this.UA,
      }

      this.logger.debug(`Request headers:`, requestHeaders)

      const response = await axios({
        method: 'GET',
        url,
        headers: requestHeaders,
        responseType: 'stream',
        timeout: 30000, // 30 seconds timeout
        onDownloadProgress: (progressEvent: any) => {
          const { loaded, total } = progressEvent

          // Calculate actual progress including resumed bytes
          const actualLoaded = loaded + start
          const actualTotal = (total || 0) + start

          if (actualTotal > 0) {
            const percent = Math.round((actualLoaded / actualTotal) * 100)

            BridgeService.shared.broadcast('update:progress', {
              percent,
              transferred: actualLoaded,
              total: actualTotal,
            })

            // Log progress every MB
            if (actualLoaded % (1024 * 1024) < 8192) {
              // Check if we crossed a MB boundary
              this.logger.debug(
                `Download progress: ${percent}% (${actualLoaded}/${actualTotal} bytes)`,
              )
            }
          }
        },
      })

      this.logger.debug(`Download response status: ${response.status}`)

      // Check for valid response codes (200 for full download, 206 for partial)
      if (response.status !== 200 && response.status !== 206) {
        throw new Error(`Request failed with status: ${response.status}`)
      }

      // Handle resume download verification
      let actualStart = start
      if (response.status === 206 && start > 0) {
        const contentRange = response.headers['content-range']
        this.logger.debug(`Content-Range: ${contentRange}`)
        if (!contentRange || !contentRange.includes(`${start}-`)) {
          this.logger.warn(
            'Server did not honor range request, starting fresh download',
          )
          // Remove existing file and start fresh
          if (existsSync(dest)) {
            unlinkSync(dest)
          }
          actualStart = 0

          // Restart download without range header
          return this.downloadFileStream(url, dest, headers, 0)
        }
      }

      // Create write stream
      const fileStream = createWriteStream(dest, {
        flags: actualStart > 0 ? 'a' : 'w',
      })

      // Pipe the response to file
      response.data.pipe(fileStream)

      return new Promise<void>((resolve, reject) => {
        fileStream.on('finish', () => {
          this.logger.info(`Download completed successfully to: ${dest}`)

          // Emit final progress (100%)
          BridgeService.shared.broadcast('update:progress', {
            percent: 100,
            transferred: fileStream.bytesWritten + actualStart,
            total: fileStream.bytesWritten + actualStart,
          })

          resolve()
        })

        fileStream.on('error', (error: Error) => {
          this.logger.error('File stream error:', error)
          reject(error)
        })

        response.data.on('error', (error: Error) => {
          this.logger.error('Response stream error:', error)
          reject(error)
        })
      })
    } catch (error: any) {
      this.logger.error('Failed to download file:', error)

      // Handle specific axios errors
      if (error.code === 'ECONNABORTED') {
        throw new Error('Download timeout')
      } else if (error.response) {
        throw new Error(`Download failed with status: ${error.response.status}`)
      } else if (error.request) {
        throw new Error('Network error during download')
      } else {
        throw error
      }
    }
  }

  async downloadAsset(url: string, dest: string): Promise<void> {
    this.logger.info(`Starting asset download: ${url} -> ${dest}`)

    const dir = dirname(dest)
    if (!existsSync(dir)) {
      this.logger.debug(`Creating directory: ${dir}`)
      mkdirSync(dir, { recursive: true })
    }

    const headers = this.createGitHubHeaders()
    await this.downloadFileStream(url, dest, headers, 0)
  }

  async downloadManifest(url: string, dest: string): Promise<unknown | null> {
    this.logger.info(`Downloading manifest: ${url} -> ${dest}`)

    try {
      const text = await this.fetchText(url)
      this.logger.debug(`Manifest raw length: ${text.length}`)

      let parsed: unknown
      try {
        parsed = yaml.load(text)
      } catch (e) {
        this.logger.error('Failed to parse manifest.yaml:', e)
        return null
      }

      writeFileSync(dest, text)
      this.logger.info(`Manifest saved successfully to: ${dest}`)

      return parsed
    } catch (error) {
      this.logger.error('Failed to download manifest:', error)
      return null
    }
  }

  /**
   * Get latest application release for the current platform, selecting the installer asset.
   * This is used for full app updates (when hot update is not applicable).
   */
  async getLatestAppRelease(
    owner: string,
    repo: string,
  ): Promise<LatestReleaseInfo | null> {
    this.logger.info(`Getting latest APP release for ${owner}/${repo}`)
    const api = `https://api.github.com/repos/${owner}/${repo}/releases/latest`

    try {
      const rel = await this.fetchJson<GitHubRelease>(api)
      const version = rel.tag_name?.replace(/^v/, '') ?? ''
      if (!version) return null

      // Choose asset by platform/arch and file extension
      const { platform, arch } = process

      const byExt = (name: string, exts: string[]) =>
        exts.some((ext) => name.toLowerCase().endsWith(ext))

      const containsArch = (name: string) =>
        arch === 'arm64' ? /arm64|aarch64/i.test(name) : /x64|amd64/i.test(name)

      let candidate: GitHubAsset | undefined

      switch (platform) {
        case 'darwin': {
          // Prefer renamed pattern from forge postMake: macos-<arch>.dmg|zip
          candidate = rel.assets.find(
            (a) =>
              /macos-/i.test(a.name) &&
              containsArch(a.name) &&
              byExt(a.name, ['.dmg', '.zip']),
          )
          // Fallback: any dmg/zip
          candidate ||= rel.assets.find((a) => byExt(a.name, ['.dmg', '.zip']))

          break
        }
        case 'win32': {
          // Prefer windows-<arch>.exe
          candidate = rel.assets.find(
            (a) =>
              /windows-/i.test(a.name) &&
              containsArch(a.name) &&
              byExt(a.name, ['.exe']),
          )
          candidate ||= rel.assets.find((a) => byExt(a.name, ['.exe']))

          break
        }
        case 'linux': {
          // Prefer linux-<arch>.AppImage
          candidate = rel.assets.find(
            (a) =>
              /linux-/i.test(a.name) &&
              containsArch(a.name) &&
              byExt(a.name, ['.appimage']),
          )
          candidate ||= rel.assets.find((a) =>
            byExt(a.name, ['.AppImage', '.appimage']),
          )

          break
        }
        // No default
      }

      // Generic fallback: first asset
      candidate ||= rel.assets[0]

      if (!candidate) {
        this.logger.warn('No suitable installer asset found in app release')
        return null
      }

      return {
        version,
        assetUrl: candidate.browser_download_url,
        assetName: candidate.name,
        prerelease: rel.prerelease,
      }
    } catch (error) {
      this.logger.error('Failed to get latest app release:', error)
      return null
    }
  }
}
