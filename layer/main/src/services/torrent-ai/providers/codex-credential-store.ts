import { existsSync, readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

import type {
  Credential,
  CredentialInfo,
  CredentialStore,
} from '@earendil-works/pi-ai'

const CODEX_PROVIDER = 'openai-codex'

interface CodexTokens {
  [key: string]: unknown
  access_token: string
  refresh_token: string
}

interface CodexAuthFile {
  [key: string]: unknown
  last_refresh?: string
  tokens?: CodexTokens
}

export function defaultCodexAuthPath(): string {
  const home = process.env.CODEX_HOME || path.join(homedir(), '.codex')
  return path.join(home, 'auth.json')
}

function jwtExpiryMs(token: string): number {
  try {
    const payload = token.split('.')[1]
    if (!payload) {
      return 0
    }
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { exp?: unknown }
    return typeof claims.exp === 'number' ? claims.exp * 1000 : 0
  } catch {
    return 0
  }
}

function isCodexAuthFile(value: unknown): value is CodexAuthFile {
  if (!value || typeof value !== 'object') {
    return false
  }
  const tokens = (value as CodexAuthFile).tokens
  return (
    typeof tokens?.access_token === 'string' &&
    typeof tokens.refresh_token === 'string'
  )
}

function credentialFromAuthFile(auth: CodexAuthFile): Credential {
  const tokens = auth.tokens as CodexTokens
  return {
    type: 'oauth',
    access: tokens.access_token,
    refresh: tokens.refresh_token,
    expires: jwtExpiryMs(tokens.access_token),
  }
}

async function readCodexAuthFile(
  authPath: string,
): Promise<CodexAuthFile | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(authPath, 'utf8'))
    return isCodexAuthFile(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

export function hasCodexOAuthCredential(
  authPath = defaultCodexAuthPath(),
): boolean {
  try {
    if (!existsSync(authPath)) {
      return false
    }
    const parsed: unknown = JSON.parse(readFileSync(authPath, 'utf8'))
    return isCodexAuthFile(parsed)
  } catch {
    return false
  }
}

export async function readCodexCredential(
  authPath = defaultCodexAuthPath(),
): Promise<Credential | undefined> {
  const auth = await readCodexAuthFile(authPath)
  return auth ? credentialFromAuthFile(auth) : undefined
}

async function writeCodexCredential(
  authPath: string,
  credential: Credential,
): Promise<void> {
  if (credential.type !== 'oauth') {
    throw new Error('openai-codex only accepts oauth credentials')
  }
  const existing = (await readCodexAuthFile(authPath)) ?? {}
  const updated: CodexAuthFile = {
    ...existing,
    tokens: {
      ...existing.tokens,
      access_token: credential.access,
      refresh_token: credential.refresh,
    },
    last_refresh: new Date().toISOString(),
  }
  await writeFile(authPath, `${JSON.stringify(updated, null, 2)}\n`)
}

export function createCodexCredentialStore(
  authPath = defaultCodexAuthPath(),
): CredentialStore {
  const chains = new Map<string, Promise<unknown>>()

  const enqueue = <T>(
    providerId: string,
    task: () => Promise<T>,
  ): Promise<T> => {
    const previous = chains.get(providerId) ?? Promise.resolve()
    const next = previous.then(task, task)
    chains.set(
      providerId,
      next.then(
        () => undefined,
        () => undefined,
      ),
    )
    return next
  }

  return {
    async read(providerId, options) {
      options?.signal?.throwIfAborted()
      if (providerId !== CODEX_PROVIDER) {
        return undefined
      }
      return readCodexCredential(authPath)
    },

    async list(options) {
      options?.signal?.throwIfAborted()
      const credential = await readCodexCredential(authPath)
      if (!credential) {
        return []
      }
      const infos: CredentialInfo[] = [
        { providerId: CODEX_PROVIDER, type: credential.type },
      ]
      return infos
    },

    async modify(providerId, fn, options) {
      options?.signal?.throwIfAborted()
      return enqueue(providerId, async () => {
        options?.signal?.throwIfAborted()
        if (providerId !== CODEX_PROVIDER) {
          return fn(undefined)
        }
        const current = await readCodexCredential(authPath)
        const next = await fn(current)
        if (!next) {
          return current
        }
        await writeCodexCredential(authPath, next)
        return readCodexCredential(authPath)
      })
    },

    async delete(_providerId, options) {
      options?.signal?.throwIfAborted()
    },
  }
}

let sharedStore: CredentialStore | undefined

export function getCodexCredentialStore(): CredentialStore {
  sharedStore ??= createCodexCredentialStore()
  return sharedStore
}
