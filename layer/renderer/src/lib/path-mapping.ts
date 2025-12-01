import path from 'node:path'

import type { PathMappingEntry } from '~/atoms/settings/path-mappings'
import { getPathMappings } from '~/atoms/settings/path-mappings'

const PROTOCOL_REGEX = /^([a-z][a-z0-9+.-]*:\/\/)(.*)$/i

const isUrl = (value: string) => PROTOCOL_REGEX.test(value.trim())

const normalizeForMatch = (value: string): string => {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  let working = trimmed
  let protocol = ''
  const protocolMatch = PROTOCOL_REGEX.exec(working)
  if (protocolMatch) {
    protocol = protocolMatch[1]
    working = protocolMatch[2]
  }

  const hadLeadingDoubleSlash =
    !protocol && (working.startsWith('\\\\') || working.startsWith('//'))

  if (hadLeadingDoubleSlash) {
    working = working.replace(/^\\\\/, '').replace(/^\/\//, '')
  }

  working = working.replaceAll('\\', '/')
  working = path.posix.normalize(working)
  if (working === '.') working = ''

  if (protocol) {
    const normalized = `${protocol}${working}`
    return normalized || protocol.replaceAll(/\/+$/g, '')
  }

  if (hadLeadingDoubleSlash) {
    return working ? `//${working}` : '//'
  }

  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) {
    return working ? `/${working}` : '/'
  }

  return working
}

const matchNormalizedPath = (
  remote: string,
  base: string,
  caseSensitive: boolean,
): { rest: string } | null => {
  if (!remote || !base) return null
  const remoteComparable = caseSensitive ? remote : remote.toLowerCase()
  const baseComparable = caseSensitive ? base : base.toLowerCase()

  if (!remoteComparable.startsWith(baseComparable)) return null

  if (remoteComparable.length === baseComparable.length) {
    return { rest: '' }
  }

  if (baseComparable === '/' || baseComparable === '//') {
    const rest = remote.slice(base.length).replace(/^\/+/, '')
    return { rest }
  }

  const boundary = remoteComparable[baseComparable.length]
  if (boundary !== '/') return null

  const rest = remote.slice(base.length + 1)
  return { rest }
}

const joinLocalPath = (base: string, rest: string): string => {
  const sanitizedRest = rest.replace(/^[/\\]+/, '')
  if (!sanitizedRest) return base
  if (!base) return sanitizedRest

  if (isUrl(base)) {
    const trimmedBase = base.replaceAll(/\/+$/g, '')
    return `${trimmedBase}/${sanitizedRest.replaceAll('\\', '/')}`
  }

  if (base.startsWith('\\\\') || /^[A-Z]:/i.test(base) || base.includes('\\')) {
    const normalizedBase = path.win32.normalize(base).replaceAll(/[\\/]+$/g, '')
    const normalizedRest = path.win32.normalize(
      sanitizedRest.replaceAll('/', '\\'),
    )
    return normalizedBase
      ? `${normalizedBase}${normalizedBase.endsWith('\\') ? '' : '\\'}${normalizedRest}`
      : normalizedRest
  }

  const normalizedBase = path.posix
    .normalize(base.replaceAll('\\', '/'))
    .replaceAll(/\/+$/g, '')
  const normalizedRest = sanitizedRest.replaceAll('\\', '/')
  return normalizedBase ? `${normalizedBase}/${normalizedRest}` : normalizedRest
}

export interface ResolvedPathMapping {
  mapping: PathMappingEntry
  path: string
}

interface ResolveOptions {
  serverId?: string | null
}

const resolveMatch = (
  remotePath: string,
  options?: ResolveOptions,
): { mapping: PathMappingEntry; rest: string } | null => {
  const trimmed = remotePath?.trim()
  if (!trimmed) return null

  const normalizedRemote = normalizeForMatch(trimmed)
  if (!normalizedRemote) return null

  const serverId = options?.serverId ?? null
  const mappings = getPathMappings()
  let best: { mapping: PathMappingEntry; rest: string; weight: number } | null =
    null

  for (const entry of mappings) {
    if (!entry?.enabled) continue
    if (!entry.remoteBasePath || !entry.localBasePath) continue
    if (entry.serverId && serverId && entry.serverId !== serverId) continue

    const normalizedBase = normalizeForMatch(entry.remoteBasePath)
    if (!normalizedBase) continue

    const match = matchNormalizedPath(
      normalizedRemote,
      normalizedBase,
      entry.caseSensitive,
    )
    if (!match) continue

    const weight = normalizedBase.length
    if (!best || weight > best.weight) {
      best = { mapping: entry, rest: match.rest, weight }
    }
  }

  if (!best) return null
  return { mapping: best.mapping, rest: best.rest }
}

export const resolveMappedPath = (
  remotePath: string,
  options?: ResolveOptions,
): ResolvedPathMapping | null => {
  const match = resolveMatch(remotePath, options)
  if (!match) return null

  const resolvedPath = joinLocalPath(match.mapping.localBasePath, match.rest)
  return {
    mapping: match.mapping,
    path: resolvedPath,
  }
}

const dedupeCandidates = (values: string[]): string[] => {
  const result: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

export const buildPathCandidates = (
  remotePath: string,
  options?: ResolveOptions,
): { candidates: string[]; mapping: PathMappingEntry | null } => {
  const trimmed = remotePath?.trim()
  if (!trimmed) return { candidates: [], mapping: null }

  const candidates: string[] = []
  const resolved = resolveMappedPath(trimmed, options)
  if (resolved?.path) {
    candidates.push(resolved.path)
  }

  candidates.push(trimmed)

  if (typeof process !== 'undefined') {
    const { sep } = path
    if (sep === '\\' && trimmed.includes('/')) {
      candidates.push(trimmed.replaceAll('/', '\\'))
    } else if (sep === '/' && trimmed.includes('\\')) {
      candidates.push(trimmed.replaceAll('\\', '/'))
    }
  }

  return {
    candidates: dedupeCandidates(candidates),
    mapping: resolved?.mapping ?? null,
  }
}

export const buildParentPathCandidates = (
  remotePath: string,
  options?: ResolveOptions,
) => {
  const trimmed = remotePath?.trim()
  if (!trimmed) return { candidates: [], mapping: null }
  const normalized = normalizeForMatch(trimmed)
  if (!normalized) return { candidates: [], mapping: null }

  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash <= 0) {
    return buildPathCandidates(trimmed, options)
  }

  const parent = normalized.slice(0, lastSlash)
  return buildPathCandidates(parent, options)
}

export const isMappedPathAvailable = (remotePath: string) => {
  const match = resolveMatch(remotePath)
  return Boolean(match)
}
