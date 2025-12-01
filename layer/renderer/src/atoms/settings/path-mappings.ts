import { atom } from 'jotai'

import { createAtomHooks } from '~/lib/jotai'
import { storage, STORAGE_KEYS } from '~/lib/storage-keys'

export type PathMappingEntry = {
  id: string
  serverId: string | null
  remoteBasePath: string
  localBasePath: string
  enabled: boolean
  caseSensitive: boolean
  note?: string
}

const DEFAULT_CASE_SENSITIVE = false

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `mapping-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const normalizeEntry = (
  entry: Partial<PathMappingEntry>,
): PathMappingEntry | null => {
  if (!entry || typeof entry !== 'object') return null
  const remote =
    typeof entry.remoteBasePath === 'string' ? entry.remoteBasePath : ''
  const local =
    typeof entry.localBasePath === 'string' ? entry.localBasePath : ''
  return {
    id: entry.id && typeof entry.id === 'string' ? entry.id : createId(),
    serverId:
      entry.serverId && typeof entry.serverId === 'string'
        ? entry.serverId
        : null,
    remoteBasePath: remote,
    localBasePath: local,
    enabled: Boolean(entry.enabled ?? true),
    caseSensitive:
      typeof entry.caseSensitive === 'boolean'
        ? entry.caseSensitive
        : DEFAULT_CASE_SENSITIVE,
    note: entry.note && typeof entry.note === 'string' ? entry.note : undefined,
  }
}

const loadPathMappings = (): PathMappingEntry[] => {
  const stored = storage.getJSON<unknown>(STORAGE_KEYS.PATH_MAPPINGS)
  if (!Array.isArray(stored)) return []
  const entries: PathMappingEntry[] = []
  for (const raw of stored) {
    const normalized = normalizeEntry(raw as Partial<PathMappingEntry>)
    if (normalized) entries.push(normalized)
  }
  return entries
}

const persistPathMappings = (entries: PathMappingEntry[]) => {
  storage.setJSON(STORAGE_KEYS.PATH_MAPPINGS, entries)
}

const pathMappingsAtom = atom<PathMappingEntry[]>(loadPathMappings())

const [, , usePathMappings, , getPathMappings, setPathMappingsDirect] =
  createAtomHooks(pathMappingsAtom)

const setPathMappings = (
  updater:
    | PathMappingEntry[]
    | ((prev: PathMappingEntry[]) => PathMappingEntry[] | undefined),
) => {
  const current = getPathMappings()
  const next =
    typeof updater === 'function'
      ? ((
          updater as (
            prev: PathMappingEntry[],
          ) => PathMappingEntry[] | undefined
        )(current) ?? current)
      : updater
  setPathMappingsDirect(next)
  persistPathMappings(next)
}

const addPathMapping = (entry?: Partial<PathMappingEntry>) => {
  setPathMappings((prev) => {
    const normalized = normalizeEntry(entry ?? {})

    if (!normalized) {
      return prev
    }

    return [...prev, normalized]
  })
}

const updatePathMapping = (id: string, patch: Partial<PathMappingEntry>) => {
  setPathMappings((prev) =>
    prev.map((entry) =>
      entry.id === id ? { ...entry, ...patch, id: entry.id } : entry,
    ),
  )
}

const removePathMapping = (id: string) => {
  setPathMappings((prev) => prev.filter((entry) => entry.id !== id))
}

export {
  addPathMapping,
  getPathMappings,
  removePathMapping,
  setPathMappings,
  updatePathMapping,
  usePathMappings,
}
