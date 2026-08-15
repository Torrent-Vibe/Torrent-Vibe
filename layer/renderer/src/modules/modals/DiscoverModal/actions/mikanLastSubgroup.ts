import { storage, STORAGE_KEYS } from '~/lib/storage-keys'

type LastSubgroupMap = Record<string, string>

const isBrowser = typeof window !== 'undefined'

const readMap = (): LastSubgroupMap => {
  if (!isBrowser) {
    return {}
  }
  return (
    storage.getJSON<LastSubgroupMap>(
      STORAGE_KEYS.DISCOVER_MIKAN_LAST_SUBGROUP,
    ) ?? {}
  )
}

const writeMap = (next: LastSubgroupMap) => {
  if (!isBrowser) {
    return
  }
  if (Object.keys(next).length === 0) {
    storage.removeItem(STORAGE_KEYS.DISCOVER_MIKAN_LAST_SUBGROUP)
    return
  }
  storage.setJSON(STORAGE_KEYS.DISCOVER_MIKAN_LAST_SUBGROUP, next)
}

export const readLastMikanSubgroup = (bangumiId: string): string | null => {
  const id = bangumiId.trim()
  if (!id) {
    return null
  }
  return readMap()[id] ?? null
}

export const writeLastMikanSubgroup = (
  bangumiId: string,
  subgroupId: string,
) => {
  const id = bangumiId.trim()
  const subgroup = subgroupId.trim()
  if (!id || !subgroup) {
    return
  }
  const next = readMap()
  next[id] = subgroup
  writeMap(next)
}
