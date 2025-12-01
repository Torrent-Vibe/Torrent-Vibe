#!/usr/bin/env node
// Generate a flat manifest.yaml for renderer hot update releases.
// Inputs via CLI:
//  --version <string>
//  --asset-name <string>
//  --asset-path <string>
//  --asset-sha256 <hex> (optional; if omitted, computed from asset-path)
//  --required-main-hash <hex> (optional; should equal packaged package.json mainHash)
//  --output <path> (default: ./manifest.yaml)
import { createHash } from 'node:crypto'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { argv } from 'node:process'

function getArg(name, def) {
  const i = argv.indexOf(`--${name}`)
  if (i === -1) return def
  if (i + 1 >= argv.length) throw new Error(`Missing --${name} value`)
  return argv[i + 1]
}

const version = getArg('version')
const assetName = getArg('asset-name')
const assetPath = getArg('asset-path')
let assetSha256 = getArg('asset-sha256', '')
const requiredMainHash = getArg('required-main-hash', '')
const output = getArg('output', 'manifest.yaml')

if (!version || !assetName || !assetPath) {
  throw new Error(
    'Missing required args: --version, --asset-name, --asset-path',
  )
}

if (!assetSha256) {
  const buf = readFileSync(assetPath)
  assetSha256 = createHash('sha256').update(buf).digest('hex')
}

const { size } = statSync(assetPath)
const createdAt = new Date().toISOString()

// Flat YAML for easy parsing without extra deps
const lines = [
  `version: ${version}`,
  `asset_name: ${assetName}`,
  `asset_size: ${size}`,
  `asset_sha256: ${assetSha256}`,
  ...(requiredMainHash ? [`required_main_hash: ${requiredMainHash}`] : []),
  `created_at: ${createdAt}`,
]

writeFileSync(output, lines.join('\n'))
console.info('[manifest] wrote', output)
