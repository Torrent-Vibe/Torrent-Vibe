import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
} from 'node:fs'

import {
  APP_RELEASE_REPO,
  AppErrorCode,
  isAppError,
} from '@torrent-vibe/shared'
import { app } from 'electron'
import log from 'electron-log'
import { join } from 'pathe'
import semver from 'semver'

import {
  getUpdateCacheDir,
  getUpdateDir,
  getUpdateLockPath,
} from '~/config/paths'
import type { UpdateManifest } from '~/types/update-manifest'
import { parseAndValidateUpdateManifest } from '~/types/update-manifest'

import {
  UPDATE_ASSET_FILENAME,
  UPDATE_REPO_NAME,
  UPDATE_REPO_OWNER,
} from '../config/update-config'
import { UpdateManager } from '../manager/update-manager'
import { AppAutoUpdater } from './app-auto-updater'
import { BridgeService } from './bridge-service'
import type { LatestReleaseInfo } from './github-update-service'
import { GithubUpdateService } from './github-update-service'

/**
 * IPC service for renderer bootstrap to coordinate update logic.
 */
export class UpdateService {
  private constructor() {
    // Configure logger for UpdateService
    this.logger.info('UpdateService initialized')
  }
  public static shared = new UpdateService()
  private logger = log.scope('UpdateService')
  private getLatestInstalledUpdateVersion(): string | null {
    this.logger.debug('Getting latest installed update version')
    try {
      const dir = getUpdateDir()
      this.logger.debug(`Checking updates directory: ${dir}`)

      if (!existsSync(dir)) {
        this.logger.debug('Updates directory does not exist')
        return null
      }

      const versions = readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)

      this.logger.debug(
        `Found ${versions.length} version directories: ${versions.join(', ')}`,
      )

      if (versions.length === 0) {
        this.logger.debug('No version directories found')
        return null
      }

      // Sort using semver for proper semantic version comparison
      const validVersions = versions.filter((version) => {
        const cleaned = semver.clean(version)
        if (!cleaned) {
          this.logger.warn(`Invalid semantic version found: ${version}`)
          return false
        }
        return true
      })

      if (validVersions.length === 0) {
        this.logger.warn('No valid semantic versions found after filtering')
        return null
      }

      const sorted = validVersions.sort((a, b) => {
        const cleanedA = semver.clean(a)
        const cleanedB = semver.clean(b)
        if (!cleanedA || !cleanedB) return 0
        return semver.compare(cleanedA, cleanedB)
      })

      const latest = sorted.at(-1) ?? null
      this.logger.info(`Latest installed update version: ${latest}`)
      return latest
    } catch (error) {
      this.logger.error('Error getting latest installed update version:', error)
      return null
    }
  }

  /**
   * Orchestrates the complete update process including checking for updates,
   * validating compatibility, downloading packages, and preparing for installation.
   *
   * ## Architecture Overview
   * This method has been refactored from a 254-line monolithic function into a well-structured
   * workflow composed of 15 smaller, focused functions with clear separation of concerns.
   *
   * ## Process Flow Chart
   * ```
   * ┌─────────────────────────────────────────────────────────────────────────────────┐
   * │                           checkAndPrepareUpdate()                               │
   * │                     Complete Update Process Orchestrator                       │
   * └─────────────────────────────────┬───────────────────────────────────────────────┘
   *                                   │
   *                                   ▼
   * ┌─────────────────────────────────────────────────────────────────────────────────┐
   * │  1. notifyUpdateCheckStarted()                                                  │
   * │     • Broadcast 'update:checking' event to renderer                            │
   * │     • Include timestamp information                                            │
   * └─────────────────────────────────┬───────────────────────────────────────────────┘
   *                                   │
   *                                   ▼
   * ┌─────────────────────────────────────────────────────────────────────────────────┐
   * │  2. fetchLatestRelease()                                                        │
   * │     • Query GitHub API for latest release                                      │
   * │     • Extract version, asset URL, and manifest information                     │
   * └─────────────────────────────────┬───────────────────────────────────────────────┘
   *                                   │
   *                                   ▼
   *                             ┌─────────────┐
   *                             │   Latest    │────────┐
   *                             │  Release?   │        │
   *                             └─────────────┘        │
   *                                   │                │
   *                                   │ Yes            │ No
   *                                   ▼                ▼
   * ┌─────────────────────────────────────────┐  ┌──────────────────────┐
   * │  3. isUpToDate()                        │  │ handleNoReleaseFound()│
   * │     • Get installed version             │  │ • Log warning        │
   * │     • Clean and compare using semver    │  │ • Broadcast uptodate │
   * │     • Handle version format validation  │  └──────────────────────┘
   * └─────────────────────────────────────────┘              │
   *                   │                                       │
   *                   ▼                                       │
   *             ┌─────────────┐                               │
   *             │  Up to Date?│─────────────────────────────┐ │
   *             └─────────────┘                             │ │
   *                   │                                     │ │
   *                   │ No                            Yes   │ │
   *                   ▼                                     ▼ ▼
   * ┌─────────────────────────────────────────┐        ┌─────────────┐
   * │  4. prepareTempDirectory()              │        │   RETURN    │
   * │     • Create cache directory if needed  │        │  (Complete) │
   * │     • Determine package download path   │        └─────────────┘
   * └─────────────────────────────────────────┘
   *                   │
   *                   ▼
   * ┌─────────────────────────────────────────────────────────────────────────────────┐
   * │  5. processManifestAndValidate()                                                │
   * │     ┌─────────────────────────────────────────────────────────────────────────┐ │
   * │     │ 5a. downloadAndParseManifest()                                          │ │
   * │     │     • Download YAML manifest from GitHub                               │ │
   * │     │     • Parse and validate manifest structure                            │ │
   * │     │     • Verify asset name consistency                                    │ │
   * │     └─────────────────────────────────────────────────────────────────────────┘ │
   * │                                    │                                             │
   * │     ┌─────────────────────────────────────────────────────────────────────────┐ │
   * │     │ 5b. extractSha256FromManifest()                                        │ │
   * │     │     • Extract SHA256 hash for package verification                     │ │
   * │     │     • Validate hash format (64-character hex)                          │ │
   * │     └─────────────────────────────────────────────────────────────────────────┘ │
   * │                                    │                                             │
   * │     ┌─────────────────────────────────────────────────────────────────────────┐ │
   * │     │ 5c. validateCompatibility()                                            │ │
   * │     │     • Compare manifest created_at with app build time                  │ │
   * │     │     • Prevent installation of older updates                            │ │
   * │     │     • Check required_main_hash against current app                     │ │
   * │     │     • Ensure hot update compatibility                                  │ │
   * │     │     • Skip in development mode                                         │ │
   * │     └─────────────────────────────────────────────────────────────────────────┘ │
   * └─────────────────────────────────────────────────────────────────────────────────┘
   *                   │
   *                   ▼
   * ┌─────────────────────────────────────────────────────────────────────────────────┐
   * │  6. downloadUpdatePackage()                                                    │
   * │     • Use resumable download if SHA256 available                               │
   * │     • Fallback to regular download without checksum                            │
   * │     • GitHub asset download with integrity verification                        │
   * └─────────────────────────────────────────────────────────────────────────────────┘
   *                   │
   *                   ▼
   * ┌─────────────────────────────────────────────────────────────────────────────────┐
   * │  7. extractAndVerifyUpdate()                                                   │
   * │     • Use UpdateManager for extraction                                         │
   * │     • Perform signature verification                                           │
   * │     • Validate extracted content                                               │
   * └─────────────────────────────────────────────────────────────────────────────────┘
   *                   │
   *                   ▼
   * ┌─────────────────────────────────────────────────────────────────────────────────┐
   * │  8. performPostUpdateCleanup()                                                 │
   * │     • Remove old versions (retain 7 most recent)                               │
   * │     • Clear temporary download cache                                           │
   * │     • Remove stale lock files                                                  │
   * └─────────────────────────────────────────────────────────────────────────────────┘
   *                   │
   *                   ▼
   * ┌─────────────────────────────────────────────────────────────────────────────────┐
   * │  9. notifyUpdateComplete()                                                     │
   * │     • Broadcast 'update:downloaded' event                                      │
   * │     • Broadcast 'update:ready' event with version info                         │
   * │     • Log completion status                                                    │
   * └─────────────────────────────────────────────────────────────────────────────────┘
   *                   │
   *                   ▼
   *               ┌─────────────┐
   *               │  SUCCESS    │
   *               │ (Complete)  │
   *               └─────────────┘
   *
   *                     │
   *                     │ (Any error during process)
   *                     ▼
   * ┌─────────────────────────────────────────────────────────────────────────────────┐
   * │  ERROR HANDLING: handleUpdateError()                                           │
   * │     • Log detailed error information                                           │
   * │     • Broadcast 'update:error' event to renderer                               │
   * │     • Include error message and code if available                              │
   * │     • Re-throw error for caller handling                                       │
   * └─────────────────────────────────────────────────────────────────────────────────┘
   * ```
   *
   * ## Key Workflow Characteristics
   *
   * **🔄 Sequential Processing**: Each step must complete successfully before proceeding
   *
   * **🛡️ Multiple Safety Checks**:
   * - Version comparison using semantic versioning
   * - Manifest validation and compatibility checks
   * - Build time ordering to prevent downgrades
   * - SHA256 integrity verification
   *
   * **📡 Event-Driven Communication**:
   * - Real-time status updates to renderer throughout the process
   * - Event types: `checking`, `uptodate`, `downloaded`, `ready`, `error`
   *
   * **🔧 Robust Error Handling**:
   * - Centralized error handling with detailed logging
   * - Graceful degradation (e.g., download without checksum if SHA256 unavailable)
   * - Development mode exceptions for compatibility checks
   *
   * **🧹 Resource Management**:
   * - Automatic cleanup of old versions and cache
   * - Temporary directory management
   * - Lock file cleanup for stale processes
   *
   * ## Refactoring Benefits
   * - **Maintainability**: 254-line monolithic method split into 15 focused functions
   * - **Testability**: Each function can be unit tested independently
   * - **Readability**: Clear separation of concerns with descriptive function names
   * - **Debugging**: Easier to isolate and fix issues in specific workflow steps
   * - **Documentation**: Comprehensive JSDoc for each function with examples
   *
   * @throws {Error} When update checking fails, manifest validation fails,
   *                 compatibility checks fail, download fails, or extraction fails
   * @returns {Promise<void>} Resolves when update is ready or no update is needed
   *
   * @example
   * ```typescript
   * try {
   *   await updateService.checkAndPrepareUpdate()
   *   console.log('Update check completed successfully')
   * } catch (error) {
   *   console.error('Update failed:', error.message)
   * }
   * ```
   */
  async checkAndPrepareUpdate(): Promise<
    'prepared' | 'uptodate' | 'no-release' | 'incompatible' | 'error'
  > {
    // Backward-compatible wrapper. Prefer checkAndPrepareRendererHotUpdate.
    return this.checkAndPrepareRendererHotUpdate()
  }

  /**
   * Orchestrate the renderer hot update (from Release Center).
   * Network errors end the flow with error; app-version mismatch triggers app-update fallback.
   */
  async checkAndPrepareRendererHotUpdate(): Promise<
    'prepared' | 'uptodate' | 'no-release' | 'incompatible' | 'error'
  > {
    this.logger.info(
      '[RendererHotUpdate] Starting update check and preparation',
    )

    try {
      this.notifyUpdateCheckStarted()

      const latest = await this.fetchLatestRendererRelease()
      if (!latest) {
        this.logger.warn(
          'No latest renderer release found; falling back to app updater',
        )
        AppAutoUpdater.instance.initialize()
        AppAutoUpdater.instance.checkForUpdates()
        return 'incompatible'
      }

      const installed = this.getLatestInstalledUpdateVersion()
      if (await this.isUpToDate(installed, latest)) {
        return 'uptodate'
      }

      this.logger.info(
        `Update needed: ${installed || 'none'} -> ${latest.version}`,
      )

      const { tmpDir, pkgPath } = this.prepareTempDirectory(latest)
      const { expectedSha256, decision } =
        await this.processRendererManifestAndValidate(latest, tmpDir)

      // Handle compatibility decision centrally; emit events after decision finalized
      if (decision.action === 'skip' && decision.reason === 'older-than-app') {
        this.logger.info(
          'Renderer package older than app; falling back to app updater',
        )
        AppAutoUpdater.instance.initialize()
        AppAutoUpdater.instance.checkForUpdates()
        return 'incompatible'
      }
      if (decision.action === 'incompatible') {
        this.logger.info(
          'Renderer incompatible with app; falling back to app updater',
        )
        AppAutoUpdater.instance.initialize()
        AppAutoUpdater.instance.checkForUpdates()
        return 'incompatible'
      }
      if (decision.action === 'error') {
        // Defer error broadcasting to unified catch to ensure single emission
        throw new Error(decision.message)
      }

      await this.downloadRendererUpdatePackage(latest, pkgPath, expectedSha256)
      await this.extractAndVerifyRendererUpdate(pkgPath)
      await this.performPostUpdateCleanup()
      this.notifyRendererUpdateComplete(latest)
      return 'prepared'
    } catch (error) {
      this.handleUpdateError(error)
      if (
        isAppError(error) &&
        (error.code === AppErrorCode.AppVersionTooLow ||
          error.code === AppErrorCode.MainHashMissing)
      ) {
        // Hot-update incompatible with current app -> app update path
        return 'incompatible'
      }
      return 'error'
    }
  }

  /**
   * Notifies the renderer that update checking has started.
   * Broadcasts the 'update:checking' event with timestamp information.
   *
   * @private
   */
  private notifyUpdateCheckStarted(): void {
    try {
      BridgeService.shared.broadcast('update:checking', {
        startedAt: new Date().toISOString(),
      })
    } catch (e) {
      this.logger.warn('Failed to broadcast update:checking:', e)
    }
  }

  /**
   * Fetches the latest release information from the configured GitHub repository.
   *
   * @private
   * @returns {Promise<any | null>} Latest release information or null if not found
   * @throws {Error} When GitHub API request fails
   */
  private async fetchLatestRendererRelease(): Promise<LatestReleaseInfo | null> {
    const gh = new GithubUpdateService()
    this.logger.debug(
      `Checking for updates from ${UPDATE_REPO_OWNER}/${UPDATE_REPO_NAME}`,
    )

    const latest = await gh.getLatestRelease(
      UPDATE_REPO_OWNER,
      UPDATE_REPO_NAME,
    )

    if (latest) {
      this.logger.info(
        `Latest release found: ${latest.version} (prerelease: ${latest.prerelease})`,
      )
      this.logger.debug(`Asset URL: ${latest.assetUrl}`)
      this.logger.debug(`Asset Name: ${latest.assetName}`)
    }

    return latest
  }

  /**
   * Handles the case when no release is found on GitHub.
   * Broadcasts 'update:uptodate' event with 'no-release' reason.
   *
   * @private
   */
  private handleNoReleaseFound(): void {
    this.logger.warn('No latest release found')

    BridgeService.shared.broadcast('update:uptodate', {
      reason: 'no-release',
      installed: this.getLatestInstalledUpdateVersion(),
      latest: null,
    })
  }

  /**
   * Checks if the current installation is up to date compared to the latest release.
   * Uses semantic versioning for accurate version comparison.
   *
   * @private
   * @param {string | null} installed - Currently installed version
   * @param {any} latest - Latest release information from GitHub
   * @returns {Promise<boolean>} True if up to date, false if update is needed
   */
  private async isUpToDate(
    installed: string | null,
    latest: LatestReleaseInfo,
  ): Promise<boolean> {
    if (!installed) {
      return false
    }

    const cleanedInstalled = semver.clean(installed)
    const cleanedLatest = semver.clean(latest.version)

    if (!cleanedInstalled) {
      this.logger.warn(`Invalid installed version format: ${installed}`)
      return false
    }

    if (!cleanedLatest) {
      this.logger.warn(`Invalid latest version format: ${latest.version}`)
      return true // Treat invalid latest version as "up to date" to prevent issues
    }

    const comparison = semver.compare(cleanedInstalled, cleanedLatest)
    if (comparison >= 0) {
      this.logger.info(
        `Already up to date: installed ${cleanedInstalled} >= latest ${cleanedLatest}`,
      )

      BridgeService.shared.broadcast('update:uptodate', {
        reason: 'up-to-date',
        installed: cleanedInstalled,
        latest: cleanedLatest,
      })

      return true
    }

    return false
  }

  /**
   * Prepares the temporary directory structure for update downloads.
   * Creates the cache directory if it doesn't exist and determines the package path.
   *
   * @private
   * @param {any} latest - Latest release information
   * @returns {{ tmpDir: string, pkgPath: string }} Directory and package paths
   */
  private prepareTempDirectory(latest: LatestReleaseInfo): {
    tmpDir: string
    pkgPath: string
  } {
    const tmpDir = getUpdateCacheDir()
    this.logger.debug(`Using temporary directory: ${tmpDir}`)

    if (!existsSync(tmpDir)) {
      this.logger.debug('Creating temporary directory')
      mkdirSync(tmpDir, { recursive: true })
    }

    const pkgPath = join(tmpDir, latest.assetName || UPDATE_ASSET_FILENAME)
    this.logger.debug(`Package will be downloaded to: ${pkgPath}`)

    return { tmpDir, pkgPath }
  }

  /**
   * Downloads and processes the update manifest to validate compatibility and extract SHA256.
   * Performs multiple validation checks:
   * - Asset name consistency between manifest and release
   * - Main hash compatibility (for hot updates)
   * - Build time ordering (prevents downgrading to older builds)
   *
   */
  private async processRendererManifestAndValidate(
    latest: LatestReleaseInfo,
    tmpDir: string,
  ): Promise<{
    expectedSha256: string | undefined
    decision:
      | { action: 'proceed' }
      | { action: 'skip'; reason: 'older-than-app' }
      | { action: 'incompatible'; code: AppErrorCode; message: string }
      | { action: 'error'; message: string }
  }> {
    let expected = latest.expectedSha256
    this.logger.debug(`Expected SHA256 from release: ${expected || 'none'}`)

    if (!latest.manifestUrl) {
      return { expectedSha256: expected, decision: { action: 'proceed' } }
    }

    this.logger.debug(
      `Attempting to download manifest from: ${latest.manifestUrl}`,
    )

    try {
      const manifest = await this.downloadAndParseManifest(
        latest,
        tmpDir,
        latest.manifestUrl!,
      )
      expected = this.extractSha256FromManifest(manifest, expected)
      const decision = await this.validateRendererCompatibility(
        manifest,
        latest,
      )
      if (decision.action !== 'proceed') {
        return { expectedSha256: expected, decision }
      }
    } catch (error) {
      this.logger.error('Failed to download or validate manifest:', error)
      throw error
    }

    return { expectedSha256: expected, decision: { action: 'proceed' } }
  }

  /**
   * Downloads and parses the update manifest YAML file.
   *
   * @private
   * @param {any} latest - Latest release information
   * @param {string} tmpDir - Temporary directory path
   * @returns {Promise<any>} Parsed and validated manifest object
   * @throws {Error} When manifest download or parsing fails
   */
  private async downloadAndParseManifest(
    latest: LatestReleaseInfo,
    tmpDir: string,
    manifestUrl: string,
  ): Promise<UpdateManifest> {
    const gh = new GithubUpdateService()
    const manifestPath = join(tmpDir, `manifest-v${latest.version}.yaml`)
    const manifestRaw = await gh.downloadManifest(manifestUrl, manifestPath)

    if (!manifestRaw) {
      throw new Error('Manifest parse failed')
    }

    const manifest = parseAndValidateUpdateManifest(manifestRaw)

    // Ensure manifest.asset_name matches selected asset name from release info
    if (
      manifest.asset_name &&
      latest.assetName &&
      manifest.asset_name !== latest.assetName
    ) {
      throw new Error(
        `Manifest asset_name (${manifest.asset_name}) does not match release asset (${latest.assetName})`,
      )
    }

    return manifest
  }

  /**
   * Extracts SHA256 hash from manifest if not already available.
   * Validates the hash format before returning.
   *
   * @private
   * @param {any} manifest - Parsed manifest object
   * @param {string | undefined} currentExpected - Currently expected SHA256
   * @returns {string | undefined} SHA256 hash for verification
   */
  private extractSha256FromManifest(
    manifest: UpdateManifest,
    currentExpected: string | undefined,
  ): string | undefined {
    if (currentExpected) {
      return currentExpected
    }

    const yamlSha: string | undefined = manifest?.asset_sha256
    if (yamlSha && /^[a-f0-9]{64}$/i.test(yamlSha)) {
      const expected = yamlSha.toLowerCase()
      this.logger.info(`Retrieved SHA256 from manifest: ${expected}`)
      return expected
    }

    return currentExpected
  }

  /**
   * Validates compatibility between the current application and the update.
   * Checks main hash compatibility for hot updates in packaged builds.
   *
   * @private
   * @param {any} manifest - Parsed manifest object
   * @throws {Error} When compatibility check fails
   */
  /**
   * Performs complete compatibility validation for a hot update:
   * 1) Prevents downgrades by comparing manifest.created_at with __BUILD_TIME__
   * 2) Validates main hash compatibility (required_main_hash vs current package mainHash)
   *
   * Order matters: downgrade prevention runs before hash check to avoid misleading errors.
   *
   */
  private async validateRendererCompatibility(
    manifest: UpdateManifest,
    _latest: LatestReleaseInfo,
  ): Promise<
    | { action: 'proceed' }
    | { action: 'skip'; reason: 'older-than-app' }
    | { action: 'incompatible'; code: AppErrorCode; message: string }
    | { action: 'error'; message: string }
  > {
    // Dev mode: skip all compatibility checks
    if (!app.isPackaged) {
      this.logger.warn('Skipping compatibility checks in development mode')
      return { action: 'proceed' }
    }

    // 1) Build-time ordering: update must be newer than current app build
    let isNewerThanAppBuild = false

    if (manifest.created_at) {
      const updateCreatedAt = new Date(String(manifest.created_at))
      const appBuildTime = new Date(String(__BUILD_TIME__))
      if (
        !Number.isNaN(updateCreatedAt.getTime()) &&
        !Number.isNaN(appBuildTime.getTime())
      ) {
        if (updateCreatedAt.getTime() <= appBuildTime.getTime()) {
          this.logger.info(
            `Skipping hot update not newer than app build: update(${updateCreatedAt.toISOString()}) <= app(${appBuildTime.toISOString()})`,
          )
          return { action: 'skip', reason: 'older-than-app' }
        }
        isNewerThanAppBuild = true
      } else {
        this.logger.warn(
          'Unable to parse created_at or __BUILD_TIME__ for build-time check (manifest)',
        )
      }
    } else {
      this.logger.warn('No created_at in manifest for build-time check')
    }

    // 2) Main hash compatibility (only when required_main_hash present)
    const requiredMainHash: string | undefined = manifest?.required_main_hash
    if (!requiredMainHash) {
      return { action: 'proceed' }
    }

    const currentHash = this.readCurrentMainHashFromPackage()
    if (!currentHash) {
      return {
        action: 'incompatible',
        code: AppErrorCode.MainHashMissing,
        message: 'Cannot verify compatibility: mainHash missing',
      }
    }

    if (currentHash.toLowerCase() !== requiredMainHash.toLowerCase()) {
      // AppVersionTooLow only when the update is newer AND hash mismatches
      if (isNewerThanAppBuild) {
        return {
          action: 'incompatible',
          code: AppErrorCode.AppVersionTooLow,
          message: 'Incompatible hot update: mainHash mismatch',
        }
      }
      // Unknown build-time ordering: block with generic error to be safe
      this.logger.warn(
        'Hash mismatch detected but build-time ordering is unknown; blocking update',
      )
      return {
        action: 'error',
        message: 'Update build time could not be verified',
      }
    }

    this.logger.info(
      'Compatibility check passed (newer build and mainHash match)',
    )
    return { action: 'proceed' }
  }

  /**
   * Downloads the update package with optional integrity verification.
   * Uses resumable download if SHA256 hash is available, otherwise falls back to regular download.
   *
   * @private
   * @param {any} latest - Latest release information
   * @param {string} pkgPath - Local path where package will be saved
   * @param {string | undefined} expectedSha256 - Expected SHA256 for verification
   * @throws {Error} When download fails
   */
  private async downloadRendererUpdatePackage(
    latest: LatestReleaseInfo,
    pkgPath: string,
    expectedSha256: string | undefined,
  ): Promise<void> {
    const gh = new GithubUpdateService()

    this.logger.info('Starting package download...')
    if (expectedSha256) {
      this.logger.debug('Using resumable download with checksum verification')
      await gh.downloadWithResume(latest.assetUrl, pkgPath, expectedSha256)
    } else {
      this.logger.warn(
        'Downloading without checksum verification (signature verification will still protect)',
      )
      await gh.downloadAsset(latest.assetUrl, pkgPath)
    }
    this.logger.info('Package download completed successfully')
  }

  /**
   * Extracts and verifies the downloaded update package.
   * Uses UpdateManager to perform extraction with signature verification.
   *
   * @private
   * @param {string} pkgPath - Path to the downloaded package
   * @throws {Error} When extraction or verification fails
   */
  private async extractAndVerifyUpdate(pkgPath: string): Promise<void> {
    this.logger.info('Starting update extraction and verification')
    const um = UpdateManager.getInstance()
    await um.extractUpdate(pkgPath)
    this.logger.info('Update extraction and verification completed')
  }

  // Backward-compatible alias
  private async extractAndVerifyRendererUpdate(pkgPath: string): Promise<void> {
    return this.extractAndVerifyUpdate(pkgPath)
  }

  /**
   * Performs post-update cleanup including removing old versions and clearing cache.
   * Retains up to 7 recent versions by default.
   *
   * @private
   */
  private async performPostUpdateCleanup(): Promise<void> {
    try {
      await this.cleanup(7)
    } catch (e) {
      this.logger.warn('Post-update cleanup encountered issues:', e)
    }
  }

  /**
   * Notifies the renderer about successful update completion.
   * Broadcasts both 'update:downloaded' and 'update:ready' events.
   *
   * @private
   * @param {any} latest - Latest release information
   */
  private notifyRendererUpdateComplete(latest: LatestReleaseInfo): void {
    // Emit downloaded event
    this.logger.info('Notifying renderer about update download completion')
    BridgeService.shared.broadcast('update:downloaded', {
      version: latest.version,
    })

    // Notify renderer to reload
    this.logger.info('Notifying renderer about update readiness')
    const updateInfo = {
      version: latest.version,
      prerelease: latest.prerelease ?? false,
    }
    this.logger.debug('Sending update:ready event with:', updateInfo)
    BridgeService.shared.broadcast('update:ready', updateInfo)
    this.logger.info('Update ready notification sent to renderer')
  }

  // Removed browser-based installer opening; app updates are handled by UpdateOrchestrator via AppAutoUpdater

  /**
   * Expose a helper to get app-level latest installer (platform-specific) from GitHub Releases.
   * Renderer can show a button linking to this URL when hot update is incompatible.
   */
  public async getLatestAppInstallerUrl(): Promise<string | null> {
    try {
      const gh = new GithubUpdateService()

      const [owner, repo] = String(APP_RELEASE_REPO).split('/')
      if (!owner || !repo) return null
      const rel = await gh.getLatestAppRelease(owner, repo)
      return rel?.assetUrl ?? null
    } catch (e) {
      this.logger.warn('Failed to get latest app installer url:', e)
      return null
    }
  }

  /**
   * Handles errors that occur during the update process.
   * Logs the error and broadcasts 'update:error' event to the renderer.
   *
   * @private
   * @param {unknown} error - The error that occurred
   */
  private handleUpdateError(error: unknown): void {
    this.logger.error('Error during update check and preparation:', error)

    // Emit error event to renderer
    const errorMessage = error instanceof Error ? error.message : String(error)
    const payload: any = {
      message: errorMessage,
      code: isAppError(error) ? error.code : undefined,
    }

    // If hot update is incompatible with current app, provide app installer URL as fallback
    const incompatible =
      isAppError(error) &&
      (error.code === AppErrorCode.AppVersionTooLow ||
        error.code === AppErrorCode.MainHashMissing)
    if (incompatible) {
      void this.getLatestAppInstallerUrl()
        .then((url) => {
          if (url) {
            payload.downloadUrl = url
          }
          BridgeService.shared.broadcast('update:error', payload)
        })
        .catch(() => {
          BridgeService.shared.broadcast('update:error', payload)
        })
      return
    }

    BridgeService.shared.broadcast('update:error', payload)
  }

  /**
   * Cleanup outdated update resources and caches.
   * - Keeps up to `retainVersions` most recent versions in userData/updates (default: 2)
   * - Removes invalid or incomplete version directories (missing index.html)
   * - Clears temporary download cache (userData/update-cache)
   * - Removes stale update lock file if older than 30 minutes
   */
  async cleanup(retainVersions = 2): Promise<void> {
    const updatesDir = getUpdateDir()
    const cacheDir = getUpdateCacheDir()
    const lockFile = getUpdateLockPath()

    this.logger.info('Starting cleanup of update resources', {
      retainVersions,
      updatesDir,
      cacheDir,
    })

    // 1) Cleanup updates directory: keep newest N versions (by semver if possible; otherwise mtime)
    try {
      if (existsSync(updatesDir)) {
        const entries = readdirSync(updatesDir, { withFileTypes: true })

        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
        const files = entries.filter((e) => e.isFile()).map((e) => e.name)

        // Remove leftover archives
        const archiveFiles = files.filter((f) => /\.tar\.gz$/i.test(f))
        for (const f of archiveFiles) {
          try {
            unlinkSync(join(updatesDir, f))
            this.logger.info('Removed leftover archive', { file: f })
          } catch (e) {
            this.logger.warn('Failed to remove leftover archive', {
              file: f,
              error: e,
            })
          }
        }

        // Determine ordering of version directories
        const semverish = dirs
          .map((v) => ({ raw: v, coerced: semver.coerce(v)?.version || null }))
          .filter((x) => !!x.coerced) as { raw: string; coerced: string }[]

        const keepSet = new Set<string>()
        if (semverish.length > 0) {
          const sorted = semverish
            .map((x) => x.coerced)
            .sort(semver.compare)
            .slice(-retainVersions)
          // Map back to raw names by matching coerced prefixes
          for (const v of sorted) {
            const raw = semverish.find((x) => x.coerced === v)?.raw
            if (raw) keepSet.add(raw)
          }
        } else {
          // Fallback by directory mtime
          const sortedByTime = dirs
            .map((name) => {
              const p = join(updatesDir, name)
              try {
                const s = statSync(p)
                return { name, mtime: s.mtimeMs }
              } catch {
                return { name, mtime: 0 }
              }
            })
            .sort((a, b) => b.mtime - a.mtime)
            .slice(0, retainVersions)
          sortedByTime.forEach((x) => keepSet.add(x.name))
        }

        // Always drop invalid/incomplete directories (missing index.html)
        for (const name of Array.from(keepSet)) {
          const indexPath = join(updatesDir, name, 'index.html')
          if (!existsSync(indexPath)) {
            this.logger.warn(
              'Removing invalid update directory (missing index.html)',
              { name },
            )
            keepSet.delete(name)
          }
        }

        // Remove not-kept directories
        for (const name of dirs) {
          if (!keepSet.has(name)) {
            const p = join(updatesDir, name)
            try {
              rmSync(p, { recursive: true, force: true })
              this.logger.info('Removed outdated update directory', { name })
            } catch (e) {
              this.logger.warn('Failed to remove outdated update directory', {
                name,
                error: e,
              })
            }
          }
        }
      }
    } catch (e) {
      this.logger.warn('Cleanup of updates directory encountered issues:', e)
    }

    // 2) Clear update-cache directory fully
    try {
      if (existsSync(cacheDir)) {
        rmSync(cacheDir, { recursive: true, force: true })
        this.logger.info('Cleared update-cache directory')
      }
      mkdirSync(cacheDir, { recursive: true })
    } catch (e) {
      this.logger.warn('Cleanup of update-cache encountered issues:', e)
    }

    // 3) Remove stale lock (>30 minutes old)
    try {
      if (existsSync(lockFile)) {
        const s = statSync(lockFile)
        const ageMs = Date.now() - s.mtimeMs
        const THIRTY_MIN = 30 * 60 * 1000
        if (ageMs > THIRTY_MIN) {
          unlinkSync(lockFile)
          this.logger.info('Removed stale update lock file')
        }
      }
    } catch (e) {
      this.logger.warn('Cleanup of update.lock encountered issues:', e)
    }

    this.logger.info('Cleanup completed')
  }

  private readCurrentMainHashFromPackage(): string | null {
    try {
      const pkgPath = join(app.getAppPath(), 'package.json')
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as any
      const hash: string | undefined = pkg.mainHash
      return hash ? String(hash) : null
    } catch (e) {
      this.logger.error('Failed to read mainHash from package.json:', e)
      return null
    }
  }
}
