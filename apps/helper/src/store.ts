import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { HelperReplica } from '@torrent-vibe/helper-protocol'

export interface ReplicaStore {
  load: () => Promise<HelperReplica[]>
  save: (replicas: HelperReplica[]) => Promise<void>
}

export function createFileReplicaStore(dataDir: string): ReplicaStore {
  const file = join(dataDir, 'replicas.json')

  return {
    async load() {
      try {
        const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))
        if (
          parsed
          && typeof parsed === 'object'
          && 'replicas' in parsed
          && Array.isArray(parsed.replicas)
        ) {
          return parsed.replicas as HelperReplica[]
        }
        return []
      }
      catch (error) {
        if (isEnoent(error)) {
          return []
        }
        throw error
      }
    },
    async save(replicas) {
      await mkdir(dataDir, { recursive: true })
      const tmp = `${file}.${randomBytes(8).toString('hex')}.tmp`
      await writeFile(tmp, `${JSON.stringify({ replicas }, null, 2)}\n`)
      await rename(tmp, file)
    },
  }
}

function isEnoent(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && error.code === 'ENOENT',
  )
}
