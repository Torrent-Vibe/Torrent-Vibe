#!/usr/bin/env node
/* eslint-disable no-use-before-define */
// Generate electron-updater metadata (latest*.yml) for each platform.
// Can run standalone or be imported from build scripts.

import { createHash } from 'node:crypto'
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const SUPPORTED_PLATFORMS = ['win32', 'darwin', 'linux']

export const generateMetadata = ({
  version,
  entries,
  releaseDate = new Date().toISOString(),
}) => {
  if (!version) throw new Error('version is required')

  for (const entry of entries) {
    if (!entry?.path) continue
    const metadataPath = resolveMetadataPath(entry)
    if (!metadataPath) continue
    const yaml = buildLatestYaml({
      version,
      releaseDate,
      artifactPath: entry.path,
      platform: entry.platform,
    })
    writeFileSync(metadataPath, yaml)
    console.info('[metadata] wrote', metadataPath)
  }
}

export const collectArtifacts = (outDir, overrides = {}) => {
  const entries = []

  const lookup = {
    win32: 'squirrel',
    darwin: 'zip',
    linux: 'appimage',
    ...overrides,
  }

  for (const platform of SUPPORTED_PLATFORMS) {
    const base = lookup[platform]
    if (!base) continue
    const baseDir = resolve(outDir, base)
    if (!existsSync(baseDir)) continue
    for (const arch of readdirSync(baseDir)) {
      const archDir = join(baseDir, arch)
      if (!isDirectory(archDir)) continue

      if (platform === 'darwin') {
        const latestZip = findLatestFile(archDir, '.zip')
        if (latestZip) {
          entries.push({ platform, arch, path: latestZip })
        }
        continue
      }

      const files = readdirSync(archDir)
      for (const file of files) {
        const absPath = join(archDir, file)
        if (!isFile(absPath)) continue
        if (!isSupportedArtifact(platform, file)) continue
        entries.push({ platform, arch, path: absPath })
      }
    }
  }

  return entries
}

export const dedupeArtifacts = (entries) => {
  const seen = new Set()
  const unique = []
  for (const entry of entries) {
    if (!entry) continue
    const key = `${entry.platform}:${entry.arch}:${entry.path}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(entry)
  }
  return unique
}

const resolveMetadataPath = (entry) => {
  const dir = dirname(entry.path)
  const safeArch = entry.arch || 'x64'
  if (entry.platform === 'win32') {
    return join(
      dir,
      safeArch === 'x64' ? 'latest.yml' : `latest-${safeArch}.yml`,
    )
  }
  if (entry.platform === 'darwin') {
    return join(
      dir,
      safeArch === 'x64' ? 'latest-mac.yml' : `latest-mac-${safeArch}.yml`,
    )
  }
  if (entry.platform === 'linux') {
    return join(
      dir,
      safeArch === 'x64' ? 'latest-linux.yml' : `latest-linux-${safeArch}.yml`,
    )
  }
  return null
}

const buildLatestYaml = ({ version, releaseDate, artifactPath, platform }) => {
  const name = basename(artifactPath)
  const { size } = statSync(artifactPath)
  const sha512 = createHash('sha512')
    .update(readFileSync(artifactPath))
    .digest('base64')

  const lines = [
    `version: ${version}`,
    'files:',
    `  - url: ${name}`,
    `    sha512: ${sha512}`,
    `    size: ${size}`,
  ]

  if (platform === 'darwin') lines.push('    type: zip')
  if (platform === 'linux') lines.push('    type: AppImage')

  lines.push(
    `path: ${name}`,
    `sha512: ${sha512}`,
    `releaseDate: '${releaseDate}'`,
  )

  return `${lines.join('\n')}\n`
}

const isSupportedArtifact = (platform, fileName) => {
  if (platform === 'win32') return fileName.endsWith('.exe')
  if (platform === 'darwin') return fileName.endsWith('.zip')
  if (platform === 'linux') return fileName.endsWith('.AppImage')
  return false
}

const isDirectory = (p) => {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

const isFile = (p) => {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

const findLatestFile = (dir, ext) => {
  try {
    const matches = readdirSync(dir)
      .filter((file) => file.toLowerCase().endsWith(ext.toLowerCase()))
      .map((file) => ({
        file,
        mtime: statSync(join(dir, file)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime)
    if (matches.length === 0) return
    return join(dir, matches[0].file)
  } catch {
    return
  }
}

const parseArtifactSpec = (spec) => {
  const parts = spec.split(',')
  const result = {}
  for (const part of parts) {
    const [key, value] = part.split('=')
    if (!key || value === undefined) continue
    result[key.trim()] = value.trim()
  }
  if (!result.path || !result.platform) return null
  return {
    path: result.path,
    platform: result.platform,
    arch: result.arch || 'x64',
  }
}

const isCli = () => {
  const entry = process.argv[1]
  if (!entry) return false
  return pathToFileURL(entry).href === import.meta.url
}

if (isCli()) {
  const args = process.argv.slice(2)
  let version = process.env.APP_VERSION || process.env.BUILD_VERSION || ''
  let baseDir = resolve(process.cwd(), 'out/make')
  const artifacts = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--version') {
      version = args[++i] || version
      continue
    }
    if (arg === '--dir') {
      baseDir = resolve(process.cwd(), args[++i] || '.')
      continue
    }
    if (arg === '--artifact') {
      const spec = args[++i]
      if (spec) {
        const parsed = parseArtifactSpec(spec)
        if (parsed) artifacts.push(parsed)
      }
      continue
    }
  }

  if (!version) {
    throw new Error('APP_VERSION, BUILD_VERSION, or --version must be provided')
  }

  let entries = artifacts
  if (entries.length === 0) {
    entries = collectArtifacts(baseDir)
  }

  generateMetadata({ version, entries: dedupeArtifacts(entries) })
}

export default generateMetadata
