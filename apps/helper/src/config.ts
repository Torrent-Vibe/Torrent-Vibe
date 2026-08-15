import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface HelperConfig {
  libraryRoot: string
  qbitUrl: string
  qbitUser: string
  qbitPass: string
  token: string
  port: number
  dataDir: string
  version: string
}

export const DEFAULT_HELPER_PORT = 17890
export const HELPER_VERSION = '0.0.1'

const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function parsePort(value: string | undefined): number {
  const port = Number(value)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return DEFAULT_HELPER_PORT
  }
  return port
}

export function generatePairingCode(): string {
  const bytes = randomBytes(6)
  let code = ''
  for (const byte of bytes) {
    code += PAIRING_ALPHABET[byte % PAIRING_ALPHABET.length]!
  }
  return code
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): HelperConfig {
  return {
    libraryRoot: env.LIBRARY_ROOT ?? '',
    qbitUrl: env.QBIT_URL ?? 'http://127.0.0.1:8080',
    qbitUser: env.QBIT_USER ?? 'admin',
    qbitPass: env.QBIT_PASS ?? '',
    token: env.TOKEN ?? '',
    port: parsePort(env.PORT),
    dataDir: env.DATA_DIR ?? './data',
    version: env.HELPER_VERSION ?? HELPER_VERSION,
  }
}

export async function resolveToken(
  config: HelperConfig,
): Promise<HelperConfig> {
  if (config.token) {
    return config
  }

  await mkdir(config.dataDir, { recursive: true })
  const tokenPath = join(config.dataDir, 'token')
  try {
    const existing = (await readFile(tokenPath, 'utf8')).trim()
    if (existing) {
      return { ...config, token: existing }
    }
  }
  catch (error) {
    if (!isEnoent(error)) {
      throw error
    }
  }

  const token = randomBytes(32).toString('hex')
  await writeFile(tokenPath, token, { mode: 0o600 })
  return { ...config, token }
}

function isEnoent(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && error.code === 'ENOENT',
  )
}
