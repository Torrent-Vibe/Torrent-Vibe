import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { app, dialog, Notification, shell } from 'electron'
import electronLog from 'electron-log'

import type { SparkleBridge, SparkleInitOptions } from './sparkle'
import { loadSparkleBridgeForApp } from './sparkle'
import type { UpdaterStatusStore, UpdaterUiStatus } from './status'
import { createUpdaterStatusStore } from './status'

const OWNER_REPO = 'Torrent-Vibe/Torrent-Vibe'
const RELEASES_URL = `https://api.github.com/repos/${OWNER_REPO}/releases/latest`
const THROTTLE_MS = 60 * 60 * 1000
const CHECK_DELAY_MS = 10_000
const FETCH_TIMEOUT_MS = 5_000

// Mirrors the packaged Info.plist SUFeedURL/SUPublicEDKey — belt-and-braces path for
// builds where Info.plist lacks those keys. CI injects the real EdDSA public key over
// this placeholder at package time.
const SPARKLE_APPCAST_URL
  = 'https://github.com/Torrent-Vibe/Torrent-Vibe/releases/latest/download/appcast.xml'
const SPARKLE_PUBLIC_ED_KEY_PLACEHOLDER = 'SPARKLE_ED_PUBLIC_KEY_PLACEHOLDER'

export interface ReleaseInfo {
  version: string
  htmlUrl: string
}

export type CheckForUpdateResult
  = | { kind: 'throttled' }
    | { kind: 'fetch-failed', message: string }
    | { kind: 'no-release' }
    | { kind: 'up-to-date', current: string, latest: string }
    | { kind: 'available', release: ReleaseInfo }

export interface UpdaterDeps {
  currentVersion: string
  now: () => string
  fetchJson: (url: string) => Promise<unknown>
  readLastCheck: () => Promise<string | null>
  writeLastCheck: (iso: string) => Promise<void>
  notify: (release: ReleaseInfo) => void
  log?: (message: string) => void
  force?: boolean
  silent?: boolean
}

function normalizeVersion(raw: string): number[] {
  const stripped = raw.replace(/^desktop-v/i, '').replace(/^v/i, '')
  return stripped.split('.').map((part) => {
    const n = Number.parseInt(part, 10)
    return Number.isNaN(n) ? 0 : n
  })
}

export function isNewerVersion(current: string, latest: string): boolean {
  const a = normalizeVersion(current)
  const b = normalizeVersion(latest)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (bv > av) {
      return true
    }
    if (bv < av) {
      return false
    }
  }
  return false
}

export function shouldCheck(
  lastCheckIso: string | null,
  nowIso: string,
): boolean {
  if (!lastCheckIso) {
    return true
  }
  const last = Date.parse(lastCheckIso)
  if (Number.isNaN(last)) {
    return true
  }
  return Date.parse(nowIso) - last >= THROTTLE_MS
}

export function parseLatestRelease(json: unknown): ReleaseInfo | null {
  if (typeof json !== 'object' || json === null) {
    return null
  }
  const record = json as Record<string, unknown>
  if (record.draft === true) {
    return null
  }
  const { tag_name, html_url } = record
  if (typeof tag_name !== 'string' || typeof html_url !== 'string') {
    return null
  }
  return { version: tag_name, htmlUrl: html_url }
}

export async function checkForUpdate(
  deps: UpdaterDeps,
): Promise<CheckForUpdateResult> {
  const nowIso = deps.now()
  if (!deps.force) {
    const lastCheck = await deps.readLastCheck()
    if (!shouldCheck(lastCheck, nowIso)) {
      deps.log?.('skipped: throttled')
      return { kind: 'throttled' }
    }
  }

  let json: unknown
  try {
    json = await deps.fetchJson(RELEASES_URL)
  }
  catch (err) {
    const message = (err as Error).message
    deps.log?.(`skipped: fetch failed (${message})`)
    return { kind: 'fetch-failed', message }
  }

  await deps.writeLastCheck(nowIso)

  const release = parseLatestRelease(json)
  if (!release) {
    deps.log?.('no-op: no usable release found')
    return { kind: 'no-release' }
  }
  if (!isNewerVersion(deps.currentVersion, release.version)) {
    deps.log?.(
      `no-op: up to date (current ${deps.currentVersion}, latest ${release.version})`,
    )
    return {
      kind: 'up-to-date',
      current: deps.currentVersion,
      latest: release.version,
    }
  }
  if (!deps.silent) {
    deps.notify(release)
    deps.log?.(`notified: ${release.version} available`)
  }
  else {
    deps.log?.(`silent available: ${release.version}`)
  }
  return { kind: 'available', release }
}

interface PersistedState {
  lastCheckIso?: string
}

async function readLastCheckFile(filePath: string): Promise<string | null> {
  try {
    const raw = await readFile(filePath, 'utf8')
    const state = JSON.parse(raw) as PersistedState
    return typeof state.lastCheckIso === 'string' ? state.lastCheckIso : null
  }
  catch {
    return null
  }
}

async function writeLastCheckFile(
  filePath: string,
  iso: string,
): Promise<void> {
  const state: PersistedState = { lastCheckIso: iso }
  await writeFile(filePath, JSON.stringify(state))
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'accept': 'application/vnd.github+json',
        'user-agent': 'torrent-vibe-updater',
      },
    })
    if (!res.ok) {
      return { message: `http ${res.status}` }
    }
    return await res.json()
  }
  finally {
    clearTimeout(timer)
  }
}

export interface InitUpdaterOptions {
  delayMs?: number
  isDev?: boolean
  showMessage?: (options: {
    type: 'info' | 'warning' | 'error'
    title: string
    message: string
  }) => void
}

export interface StartUpdaterDeps {
  sparkleBridge: SparkleBridge | null
  sparkleOptions: SparkleInitOptions
  runWeakChecker: () => void
  log?: (message: string) => void
}

export function startUpdater(deps: StartUpdaterDeps): 'sparkle' | 'weak' {
  if (deps.sparkleBridge) {
    try {
      if (deps.sparkleBridge.init(deps.sparkleOptions)) {
        deps.log?.('sparkle bridge initialized')
        return 'sparkle'
      }
      deps.log?.(
        'sparkle bridge init returned false, falling back to weak checker',
      )
    }
    catch (err) {
      deps.log?.(
        `sparkle bridge init threw (${(err as Error).message}), falling back to weak checker`,
      )
    }
  }
  else {
    deps.log?.('sparkle bridge unavailable, falling back to weak checker')
  }
  deps.runWeakChecker()
  return 'weak'
}

export type UpdaterHandle = {
  checkNow: () => void
  silentCheckOnActivate: () => void
  getStatus: () => UpdaterUiStatus
  onStatus: (cb: (status: UpdaterUiStatus) => void) => () => void
  installNow: () => void
}

type UpdaterMode = 'dev' | 'sparkle' | 'weak'

function defaultShowMessage(options: {
  type: 'info' | 'warning' | 'error'
  title: string
  message: string
}): void {
  void dialog.showMessageBox({
    type: options.type,
    title: options.title,
    message: options.message,
  })
}

function createWeakCheckDeps(log: (message: string) => void): UpdaterDeps {
  const stateFile = join(app.getPath('userData'), 'updater.json')
  return {
    currentVersion: app.getVersion(),
    now: () => new Date().toISOString(),
    fetchJson: fetchJsonWithTimeout,
    readLastCheck: () => readLastCheckFile(stateFile),
    writeLastCheck: iso => writeLastCheckFile(stateFile, iso),
    notify: (release) => {
      const notification = new Notification({
        title: 'Torrent Vibe update available',
        body: `${release.version} is ready — click to view the release`,
      })
      notification.on('click', () => {
        shell.openExternal(release.htmlUrl).catch((err) => {
          log(`skipped: openExternal failed (${(err as Error).message})`)
        })
      })
      notification.show()
    },
    log,
  }
}

export function createUpdaterHandle(options: {
  mode: UpdaterMode
  sparkleBridge?: SparkleBridge | null
  showMessage?: InitUpdaterOptions['showMessage']
  runWeakCheck?: (
    force: boolean,
    silent?: boolean,
  ) => Promise<CheckForUpdateResult>
  openRelease?: (url: string) => void
  statusStore?: UpdaterStatusStore
  log?: (message: string) => void
}): UpdaterHandle {
  const showMessage = options.showMessage ?? defaultShowMessage
  const log = options.log ?? (() => {})
  const statusStore = options.statusStore ?? createUpdaterStatusStore()
  const openRelease
    = options.openRelease
      ?? ((url: string) => {
        shell.openExternal(url).catch((err) => {
          log(`openRelease failed: ${(err as Error).message}`)
        })
      })

  let silentCheckInFlight = false

  const applyResult = (result: CheckForUpdateResult) => {
    statusStore.applyResult(result)
  }

  return {
    getStatus: () => statusStore.get(),
    onStatus: cb => statusStore.on(cb),
    silentCheckOnActivate: () => {
      if (options.mode === 'dev') {
        return
      }
      const run = options.runWeakCheck
      if (!run || silentCheckInFlight) {
        return
      }
      silentCheckInFlight = true
      void (async () => {
        try {
          const result = await run(false, true)
          applyResult(result)
        }
        catch (err) {
          log(`silentCheck failed: ${(err as Error).message}`)
        }
        finally {
          silentCheckInFlight = false
        }
      })()
    },
    checkNow: () => {
      if (options.mode === 'dev') {
        showMessage({
          type: 'info',
          title: 'Check for Updates',
          message: 'Updates are disabled in development mode.',
        })
        return
      }

      if (options.mode === 'sparkle' && options.sparkleBridge) {
        try {
          options.sparkleBridge.checkForUpdates()
        }
        catch (err) {
          log(`checkNow sparkle failed: ${(err as Error).message}`)
          showMessage({
            type: 'error',
            title: 'Check for Updates',
            message: `Failed to check for updates: ${(err as Error).message}`,
          })
        }
        return
      }

      const run = options.runWeakCheck
      if (!run) {
        showMessage({
          type: 'warning',
          title: 'Check for Updates',
          message: 'Update checking is currently unavailable.',
        })
        return
      }

      void (async () => {
        try {
          const result = await run(true, false)
          applyResult(result)
          if (result.kind === 'available') {
            return
          }
          if (result.kind === 'up-to-date') {
            showMessage({
              type: 'info',
              title: 'Check for Updates',
              message: 'You are on the latest version.',
            })
            return
          }
          if (result.kind === 'fetch-failed') {
            showMessage({
              type: 'error',
              title: 'Check for Updates',
              message: `Failed to check for updates: ${result.message}`,
            })
            return
          }
          if (result.kind === 'no-release') {
            showMessage({
              type: 'warning',
              title: 'Check for Updates',
              message: 'No published release was found.',
            })
          }
        }
        catch (err) {
          log(`checkNow weak failed: ${(err as Error).message}`)
          showMessage({
            type: 'error',
            title: 'Check for Updates',
            message: `Failed to check for updates: ${(err as Error).message}`,
          })
        }
      })()
    },
    installNow: () => {
      if (options.mode === 'dev') {
        showMessage({
          type: 'info',
          title: 'Check for Updates',
          message: 'Updates are disabled in development mode.',
        })
        return
      }

      if (options.mode === 'sparkle' && options.sparkleBridge) {
        try {
          options.sparkleBridge.installUpdateNow()
        }
        catch (err) {
          log(`installNow sparkle failed: ${(err as Error).message}`)
          showMessage({
            type: 'error',
            title: 'Check for Updates',
            message: `Failed to install update: ${(err as Error).message}`,
          })
        }
        return
      }

      const current = statusStore.get()
      if (current.kind === 'available') {
        openRelease(current.htmlUrl)
        return
      }

      const run = options.runWeakCheck
      if (!run) {
        showMessage({
          type: 'warning',
          title: 'Check for Updates',
          message: 'Update checking is currently unavailable.',
        })
        return
      }

      void (async () => {
        try {
          const result = await run(true, true)
          applyResult(result)
          if (result.kind === 'available') {
            openRelease(result.release.htmlUrl)
            return
          }
          if (result.kind === 'up-to-date') {
            showMessage({
              type: 'info',
              title: 'Check for Updates',
              message: 'You are on the latest version.',
            })
            return
          }
          showMessage({
            type: 'warning',
            title: 'Check for Updates',
            message: 'Unable to open the update page right now.',
          })
        }
        catch (err) {
          log(`installNow weak failed: ${(err as Error).message}`)
          showMessage({
            type: 'error',
            title: 'Check for Updates',
            message: `Failed to check for updates: ${(err as Error).message}`,
          })
        }
      })()
    },
  }
}

export function initSparkleUpdater(
  options: InitUpdaterOptions = {},
): UpdaterHandle {
  const isDev = options.isDev ?? process.env.ELECTRON_DEV === '1'
  const log = (message: string) => electronLog.scope('updater').debug(message)
  const showMessage = options.showMessage ?? defaultShowMessage
  const statusStore = createUpdaterStatusStore()

  if (isDev) {
    return createUpdaterHandle({ mode: 'dev', showMessage, statusStore, log })
  }

  const sparkleBridge = loadSparkleBridgeForApp(log)
  const mode = startUpdater({
    sparkleBridge,
    sparkleOptions: {
      appcastUrl: SPARKLE_APPCAST_URL,
      publicEdKey: SPARKLE_PUBLIC_ED_KEY_PLACEHOLDER,
    },
    runWeakChecker: () => {
      setTimeout(() => {
        void runElectronCheck(false, false).then(result =>
          statusStore.applyResult(result))
      }, options.delayMs ?? CHECK_DELAY_MS)
    },
    log,
  })

  // Badge detection always uses GitHub, including sparkle mode.
  if (mode === 'sparkle') {
    setTimeout(() => {
      void runElectronCheck(false, true).then(result =>
        statusStore.applyResult(result))
    }, options.delayMs ?? CHECK_DELAY_MS)
  }

  return createUpdaterHandle({
    mode,
    sparkleBridge: mode === 'sparkle' ? sparkleBridge : null,
    showMessage,
    statusStore,
    runWeakCheck: async (force, silent) => {
      const result = await runElectronCheck(force, silent === true)
      statusStore.applyResult(result)
      return result
    },
    log,
  })
}

async function runElectronCheck(
  force = false,
  silent = false,
): Promise<CheckForUpdateResult> {
  const log = (message: string) => electronLog.scope('updater').debug(message)
  const deps: UpdaterDeps = {
    ...createWeakCheckDeps(log),
    force,
    silent,
  }

  try {
    return await checkForUpdate(deps)
  }
  catch (err) {
    log(`skipped: unexpected error (${(err as Error).message})`)
    return { kind: 'fetch-failed', message: (err as Error).message }
  }
}
