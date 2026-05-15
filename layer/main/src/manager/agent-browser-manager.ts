import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import { promisify } from 'node:util'

import { app } from 'electron'

import { getLogger } from '~/config/log-config'
import { AppSettingsStore } from '~/services/app-settings-store'
import { ConcurrencyGate } from '~/utils/concurrency-gate'

const execFileAsync = promisify(execFile)

export class AgentBrowserNotFoundError extends Error {}
export class AgentBrowserError extends Error {}

export const HEADLESS_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const SESSION_NAME = 'torrent-vibe'
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 30_000

const findAgentBrowserCli = (
  preferredCandidates: Array<string | null | undefined> = [],
): string | null => {
  const isWindows = process.platform === 'win32'
  const binNames = isWindows
    ? ['agent-browser.cmd', 'agent-browser.exe', 'agent-browser.bat']
    : ['agent-browser']

  const candidates: string[] = []
  const add = (value: string | null | undefined) => {
    const trimmed = value?.trim()
    if (trimmed) {
      candidates.push(trimmed)
    }
  }

  for (const candidate of preferredCandidates) {
    add(candidate)
  }

  const dirs = new Set<string>()
  for (const entry of process.env.PATH?.split(delimiter) ?? []) {
    if (entry) {
      dirs.add(entry)
    }
  }

  const home = homedir()
  const pnpmHome = process.env.PNPM_HOME
  if (pnpmHome) {
    dirs.add(pnpmHome)
    dirs.add(join(pnpmHome, 'bin'))
  }

  if (isWindows) {
    const appData = process.env.APPDATA
    if (appData) {
      dirs.add(join(appData, 'npm'))
    }
    dirs.add(join(home, 'AppData/Local/pnpm'))
  } else {
    dirs.add('/usr/local/bin')
    dirs.add('/opt/homebrew/bin')
    dirs.add('/usr/bin')
    dirs.add(join(home, '.local/bin'))
    dirs.add(join(home, '.cargo/bin'))
    dirs.add(join(home, '.bun/bin'))
    dirs.add(join(home, 'Library/pnpm'))
    dirs.add(join(home, '.npm-global/bin'))
  }

  for (const dir of dirs) {
    for (const name of binNames) {
      add(join(dir, name))
    }
  }

  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) {
        return candidate
      }
    } catch {
      /* empty */
    }
  }

  return null
}

export const detectAgentBrowserCli = (): string | null => findAgentBrowserCli()

type AgentBrowserEnvelope = {
  success?: boolean
  data?: unknown
  error?: string | null
}

export type OpenOptions = {
  userAgent?: string
  timeoutMs?: number
}

export class AgentBrowserManager {
  private static instance: AgentBrowserManager | null = null

  static getInstance(): AgentBrowserManager {
    if (!this.instance) {
      this.instance = new AgentBrowserManager()
    }
    return this.instance
  }

  private readonly logger = getLogger('[ai.agentBrowser]')
  private readonly gate = new ConcurrencyGate(1)
  private cliPath: string | null = null
  private sessionActive = false

  private constructor() {
    app.on('before-quit', () => {
      void this.dispose()
    })
  }

  private resolveCliPath(): string {
    if (this.cliPath && existsSync(this.cliPath)) {
      return this.cliPath
    }
    const configured = AppSettingsStore.getInstance().getAgentBrowserPath()
    const found = findAgentBrowserCli([configured])
    if (!found) {
      throw new AgentBrowserNotFoundError(
        'agent-browser CLI not found. Install it with "npm i -g agent-browser && agent-browser install", or set its path in Settings → App Preferences.',
      )
    }
    this.cliPath = found
    return found
  }

  private async exec(
    subcommand: string,
    subArgs: string[],
    options: { json?: boolean; userAgent?: string; timeoutMs?: number } = {},
  ): Promise<unknown> {
    const cli = this.resolveCliPath()
    const wantJson = options.json !== false

    // agent-browser quirk: global flags precede the subcommand, --json follows it.
    const preArgs = ['--session', SESSION_NAME]
    if (options.userAgent) {
      preArgs.push('--user-agent', options.userAgent)
    }
    const args = [...preArgs, subcommand, ...subArgs]
    if (wantJson) {
      args.push('--json')
    }

    let stdout = ''
    try {
      const result = await execFileAsync(cli, args, {
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
      })
      stdout = result.stdout ?? ''
    } catch (error) {
      const failure = error as NodeJS.ErrnoException & {
        stdout?: string
        killed?: boolean
      }
      stdout = typeof failure.stdout === 'string' ? failure.stdout : ''
      if (!stdout) {
        if (failure.killed) {
          throw new AgentBrowserError(`agent-browser ${subcommand} timed out`)
        }
        throw new AgentBrowserError(
          `agent-browser ${subcommand} failed: ${failure.message ?? 'unknown error'}`,
        )
      }
    }

    if (!wantJson) {
      return undefined
    }

    let envelope: AgentBrowserEnvelope
    try {
      envelope = JSON.parse(stdout) as AgentBrowserEnvelope
    } catch {
      throw new AgentBrowserError(
        `agent-browser ${subcommand} returned malformed output`,
      )
    }
    if (!envelope.success) {
      throw new AgentBrowserError(
        envelope.error || `agent-browser ${subcommand} failed`,
      )
    }
    return envelope.data
  }

  async run<T>(task: (browser: AgentBrowserManager) => Promise<T>): Promise<T> {
    await this.gate.acquire()
    try {
      return await task(this)
    } finally {
      this.gate.release()
    }
  }

  async open(url: string, options: OpenOptions = {}): Promise<void> {
    this.sessionActive = true
    await this.exec('open', [url], {
      userAgent: options.userAgent,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    })
  }

  async waitForCondition(
    expression: string,
    timeoutMs: number,
  ): Promise<boolean> {
    try {
      await this.exec('wait', ['--fn', expression], { timeoutMs })
      return true
    } catch (error) {
      this.logger.debug('wait --fn did not settle', { error })
      return false
    }
  }

  async waitForLoad(
    state: 'load' | 'domcontentloaded' | 'networkidle',
    timeoutMs: number,
  ): Promise<void> {
    try {
      await this.exec('wait', ['--load', state], { timeoutMs })
    } catch (error) {
      this.logger.debug('wait --load did not settle', { error })
    }
  }

  async getCurrentUrl(): Promise<string> {
    const data = (await this.exec('get', ['url'])) as { url?: string } | null
    return data?.url ?? ''
  }

  async evaluate<T>(script: string): Promise<T> {
    const encoded = Buffer.from(script, 'utf8').toString('base64')
    const data = (await this.exec('eval', ['-b', encoded], {
      timeoutMs: 20_000,
    })) as { result?: T } | null
    return data?.result as T
  }

  async evaluateFn<T>(fn: () => T): Promise<T> {
    return this.evaluate<T>(`(${fn.toString()})()`)
  }

  reset(): void {
    this.cliPath = null
    void this.dispose()
  }

  async dispose(): Promise<void> {
    if (!this.sessionActive) {
      return
    }
    this.sessionActive = false
    try {
      await this.exec('close', [], { json: false, timeoutMs: 10_000 })
    } catch (error) {
      this.logger.warn('failed to close agent-browser session', { error })
    }
  }
}

export const agentBrowserManager = AgentBrowserManager.getInstance()
