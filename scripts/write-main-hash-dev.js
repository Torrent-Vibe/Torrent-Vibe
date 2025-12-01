#!/usr/bin/env node
// Compute a main layer hash for development and write it into root package.json
// so that runtime compatibility checks can work in dev.
// Priority: use built output if available (dist/main + dist/preload),
// otherwise hash the source trees (layer/main/src/main + layer/main/src/preload).
import { existsSync,readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { computeMainHashFromRoots } from './lib/main-hash.js'

const cwd = process.cwd()
const roots = []
const distMain = join(cwd, 'dist', 'main')
const distPreload = join(cwd, 'dist', 'preload')
if (existsSync(distMain)) roots.push(distMain)
if (existsSync(distPreload)) roots.push(distPreload)
if (roots.length === 0) {
  const srcMain = join(cwd, 'layer', 'main', 'src', 'main')
  const srcPreload = join(cwd, 'layer', 'main', 'src', 'preload')
  if (existsSync(srcMain)) roots.push(srcMain)
  if (existsSync(srcPreload)) roots.push(srcPreload)
}

if (roots.length === 0) {
  console.warn('[main-hash:dev] No roots found for hashing; skipping')
  process.exit(0)
}

const hash = computeMainHashFromRoots(roots, cwd)
if (!hash) {
  console.warn('[main-hash:dev] Computed empty hash; skipping')
  process.exit(0)
}

const pkgPath = join(cwd, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
pkg.mainHash = hash
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
console.info('[main-hash:dev] wrote mainHash to package.json:', hash)
