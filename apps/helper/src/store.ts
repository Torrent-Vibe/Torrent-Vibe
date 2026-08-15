import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type {
  HelperEpisodeState,
  HelperReplica,
} from '@torrent-vibe/helper-protocol'

export interface HelperEpisode {
  episodeId: string
  infohash?: string
  title: string
  season: number | null
  episode: number | null
  state: HelperEpisodeState
  lastError?: string
}

export interface ReplicaStore {
  load: () => Promise<HelperReplica[]>
  save: (replicas: HelperReplica[]) => Promise<void>
  loadEpisodes: () => Promise<Record<string, HelperEpisode[]>>
  saveEpisodes: (episodes: Record<string, HelperEpisode[]>) => Promise<void>
}

interface Persisted {
  replicas: HelperReplica[]
  episodes: Record<string, HelperEpisode[]>
}

export function createFileReplicaStore(dataDir: string): ReplicaStore {
  const file = join(dataDir, 'replicas.json')

  async function read(): Promise<Persisted> {
    try {
      const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))
      return normalizePersisted(parsed)
    }
    catch (error) {
      if (isEnoent(error)) {
        return { replicas: [], episodes: {} }
      }
      throw error
    }
  }

  async function write(data: Persisted) {
    await mkdir(dataDir, { recursive: true })
    const tmp = `${file}.${randomBytes(8).toString('hex')}.tmp`
    await writeFile(
      tmp,
      `${JSON.stringify({ replicas: data.replicas, episodes: data.episodes }, null, 2)}\n`,
    )
    await rename(tmp, file)
  }

  return {
    async load() {
      return (await read()).replicas
    },
    async save(replicas) {
      const current = await read()
      const ids = new Set(replicas.map(item => item.id))
      const episodes = Object.fromEntries(
        Object.entries(current.episodes).filter(([id]) => ids.has(id)),
      )
      await write({ replicas, episodes })
    },
    async loadEpisodes() {
      return (await read()).episodes
    },
    async saveEpisodes(episodes) {
      const current = await read()
      await write({ replicas: current.replicas, episodes })
    },
  }
}

function normalizePersisted(parsed: unknown): Persisted {
  if (!parsed || typeof parsed !== 'object') {
    return { replicas: [], episodes: {} }
  }
  const record = parsed as {
    replicas?: unknown
    episodes?: unknown
  }
  const replicas = Array.isArray(record.replicas)
    ? (record.replicas as HelperReplica[])
    : []
  const episodes
    = record.episodes
      && typeof record.episodes === 'object'
      && !Array.isArray(record.episodes)
      ? (record.episodes as Record<string, HelperEpisode[]>)
      : {}
  return { replicas, episodes }
}

function isEnoent(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && error.code === 'ENOENT',
  )
}
