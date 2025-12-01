#!/usr/bin/env node
// Generate manifest.yaml for desktop app releases, listing mainHash and build info.
// Usage: node scripts/generate-app-build-manifest.js --output <path> --tag <vYYYYMMDDHHMMSS>
// It computes mainHash as SHA-256 over dist/main + dist/preload files (path+content order-stable).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { mainHash } from './calc-main-hash.js'

function getArg(name, def) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return def
  if (i + 1 >= process.argv.length) throw new Error(`Missing --${name} value`)
  return process.argv[i + 1]
}

const outPath = getArg('output', 'release/manifest.yaml')
const tag = getArg('tag', '')

mkdirSync(dirname(outPath), { recursive: true })
const createdAt = new Date().toISOString()
const lines = [
  `tag: ${tag}`,
  `main_hash: ${mainHash}`,
  `created_at: ${createdAt}`,
]
writeFileSync(outPath, lines.join('\n'))
console.info('[app-manifest] wrote', outPath)
