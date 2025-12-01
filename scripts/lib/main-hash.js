// Shared main-layer hash utilities to ensure identical hashing in all places.
// Hash definition: SHA-256 over an ordered list of files from provided roots,
// updating the digest with each file's relative path and its content bytes.
// This avoids differences due to file ordering and ensures stability.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

function listFilesRecursive(rootDir) {
  const files = []
  const stack = [rootDir]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      const full = join(dir, ent.name)
      if (ent.isDirectory()) stack.push(full)
      else files.push(full)
    }
  }
  // Sort for deterministic order
  files.sort()
  return files
}

function computeHashForFiles(files, baseDir = process.cwd()) {
  const h = createHash('sha256')
  for (const f of files) {
    const rel = relative(baseDir, f)
    h.update(rel)
    h.update(readFileSync(f))
  }
  return h.digest('hex')
}

function computeMainHashFromRoots(roots, baseDir = process.cwd()) {
  const all = []
  for (const r of roots) {
    if (existsSync(r)) {
      all.push(...listFilesRecursive(r))
    }
  }
  if (all.length === 0) return ''
  return computeHashForFiles(all, baseDir)
}

export { computeHashForFiles, computeMainHashFromRoots, listFilesRecursive }

if (import.meta.url === `file://${process.argv[1]}`) {
  console.info(
    computeMainHashFromRoots(['dist/main', 'dist/preload'], process.cwd()),
  )
}
