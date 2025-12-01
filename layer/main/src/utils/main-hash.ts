import { createHash } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

function listFilesRecursive(rootDir: string): string[] {
  const files: string[] = []
  const stack: string[] = [rootDir]
  while (stack.length > 0) {
    const dir = stack.pop() as string
    let entries: Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true }) as Dirent[]
    } catch {
      continue
    }
    for (const ent of entries) {
      const full = join(dir, ent.name)
      if (ent.isDirectory()) stack.push(full)
      else files.push(full)
    }
  }
  files.sort()
  return files
}

export function computeHashForFiles(
  files: string[],
  baseDir = process.cwd(),
): string {
  const h = createHash('sha256')
  for (const f of files) {
    const rel = relative(baseDir, f)
    h.update(rel)
    h.update(readFileSync(f))
  }
  return h.digest('hex')
}

export function computeHashFromRoots(
  roots: string[],
  baseDir = process.cwd(),
): string {
  const all: string[] = []
  for (const r of roots) {
    if (existsSync(r)) all.push(...listFilesRecursive(r))
  }
  if (all.length === 0) return ''
  return computeHashForFiles(all, baseDir)
}
