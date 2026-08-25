import type { TorrentInfo } from '@torrent-vibe/qb-client'

export type LibraryAuditIssueKind =
  | 'missing_files'
  | 'duplicate'
  | 'path_category_mismatch'
  | 'layout_inconsistent'
  | 'helper_managed'
  | 'uncategorized'

export interface LibraryAuditIssue {
  category: string
  detail: string
  hash: string
  kind: LibraryAuditIssueKind
  memberHashes?: string[]
  name: string
  savePath: string
  tags: string[]
}

export interface LibraryAuditResult {
  byCategory: Record<string, number>
  byState: Record<string, number>
  hasMore: boolean
  helper: Array<{ savePath: string; hashes: string[] }>
  issues: LibraryAuditIssue[]
  nextOffset: number | null
  observedRoots: string[]
  scanned: number
  total: number
}

const VIDEO_FILE = /\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts|m2ts|mpg|mpeg)$/i

const posixPath = (value: string): string => value.replaceAll('\\', '/')

const torrentTags = (tags: string): string[] =>
  (tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

const stripSeason = (savePath: string): string =>
  posixPath(savePath).replace(/\/season \d+$/i, '')

const seasonLayoutKey = (savePath: string): string =>
  posixPath(savePath).replace(
    /\/season (\d+)$/i,
    (_match, digits: string) => `/Season ${'N'.padStart(digits.length, '0')}`,
  )

const pathCluster = (savePath: string): string => {
  const stripped = stripSeason(savePath)
  const absolute = stripped.startsWith('/')
  const parts = stripped.split('/').filter(Boolean)
  const cluster = parts.slice(0, 2).join('/')
  return absolute ? `/${cluster}` : cluster
}

const lastSegment = (path: string): string =>
  path.split('/').findLast(Boolean) ?? ''

const duplicateKey = (torrent: TorrentInfo): string => {
  const basename =
    posixPath(torrent.content_path || '')
      .split('/')
      .pop() ?? ''
  const source = VIDEO_FILE.test(basename)
    ? basename.replace(/\.[^.]+$/, '')
    : torrent.name
  return source
    .toLocaleLowerCase()
    .replaceAll(/\[[^\]]*]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

const isHelperManaged = (tags: string[]): boolean =>
  tags.some((tag) => tag.startsWith('tv-mikan:'))

const pushGroup = <T>(map: Map<string, T[]>, key: string, value: T): void => {
  const group = map.get(key)
  if (group) {
    group.push(value)
  } else {
    map.set(key, [value])
  }
}

const toIssue = (
  torrent: TorrentInfo,
  kind: LibraryAuditIssueKind,
  detail: string,
  memberHashes?: string[],
): LibraryAuditIssue => ({
  category: torrent.category || '',
  detail,
  hash: torrent.hash,
  kind,
  ...(memberHashes ? { memberHashes } : {}),
  name: torrent.name,
  savePath: torrent.save_path,
  tags: torrentTags(torrent.tags),
})

const increment = (counts: Record<string, number>, key: string): void => {
  counts[key] = (counts[key] ?? 0) + 1
}

const preferredCluster = (
  category: string,
  counts: Map<string, number>,
): string => {
  const expected = category.toLocaleLowerCase()
  return [...counts.keys()].toSorted((left, right) => {
    const countDiff = (counts.get(right) ?? 0) - (counts.get(left) ?? 0)
    if (countDiff !== 0) {
      return countDiff
    }
    const match = (cluster: string) =>
      lastSegment(cluster).toLocaleLowerCase() === expected ? 0 : 1
    const matchDiff = match(left) - match(right)
    return matchDiff === 0 ? left.localeCompare(right) : matchDiff
  })[0]!
}

export const auditTorrents = (torrents: TorrentInfo[]): LibraryAuditResult => {
  const byCategory: Record<string, number> = {}
  const byState: Record<string, number> = {}
  const issues: LibraryAuditIssue[] = []
  const duplicates = new Map<string, TorrentInfo[]>()
  const seriesGroups = new Map<string, TorrentInfo[]>()
  const categoryGroups = new Map<string, TorrentInfo[]>()
  const helperGroups = new Map<string, string[]>()

  for (const torrent of torrents) {
    const category = torrent.category || ''
    const tags = torrentTags(torrent.tags)
    increment(byCategory, category)
    increment(byState, torrent.state || '')

    if (torrent.state === 'missingFiles' || torrent.state === 'error') {
      issues.push(
        toIssue(
          torrent,
          'missing_files',
          `qBittorrent state is ${torrent.state}`,
        ),
      )
    }
    if (isHelperManaged(tags)) {
      issues.push(
        toIssue(
          torrent,
          'helper_managed',
          'Tagged with tv-mikan: (helper-managed)',
        ),
      )
      pushGroup(
        helperGroups,
        stripSeason(torrent.save_path || '') || torrent.save_path,
        torrent.hash,
      )
    }
    if (!category) {
      issues.push(toIssue(torrent, 'uncategorized', 'Category is empty'))
    }

    const key = duplicateKey(torrent)
    if (key) {
      pushGroup(duplicates, key, torrent)
    }
    const root = stripSeason(torrent.save_path || '')
    if (root) {
      pushGroup(seriesGroups, root, torrent)
    }
    if (category) {
      pushGroup(categoryGroups, category, torrent)
    }
  }

  for (const group of duplicates.values()) {
    if (group.length < 2) {
      continue
    }
    const memberHashes = group.map((item) => item.hash).toSorted()
    const representative =
      group.find((item) => item.hash === memberHashes[0]) ?? group[0]!
    issues.push(
      toIssue(
        representative,
        'duplicate',
        `Normalized name matches ${group.length} torrents`,
        memberHashes,
      ),
    )
  }

  for (const group of seriesGroups.values()) {
    const layouts = new Set(
      group.map((item) => seasonLayoutKey(item.save_path || '')),
    )
    if (layouts.size < 2) {
      continue
    }
    const memberHashes = group.map((item) => item.hash).toSorted()
    const representative =
      group.find((item) => item.hash === memberHashes[0]) ?? group[0]!
    issues.push(
      toIssue(
        representative,
        'layout_inconsistent',
        'Same series root uses mixed folder templates',
        memberHashes,
      ),
    )
  }

  for (const [category, group] of categoryGroups) {
    if (group.length < 2) {
      continue
    }
    const counts = new Map<string, number>()
    const clusterByHash = new Map<string, string>()
    for (const torrent of group) {
      const cluster = pathCluster(torrent.save_path || '')
      clusterByHash.set(torrent.hash, cluster)
      counts.set(cluster, (counts.get(cluster) ?? 0) + 1)
    }
    if (counts.size < 2) {
      continue
    }
    const canonical = preferredCluster(category, counts)
    for (const torrent of group) {
      if (clusterByHash.get(torrent.hash) === canonical) {
        continue
      }
      issues.push(
        toIssue(
          torrent,
          'path_category_mismatch',
          `Save path cluster differs from other torrents in category ${category}`,
        ),
      )
    }
  }

  return {
    byCategory,
    byState,
    hasMore: false,
    helper: [...helperGroups.entries()]
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([savePath, hashes]) => ({
        hashes: hashes.toSorted(),
        savePath,
      })),
    issues,
    nextOffset: null,
    observedRoots: [
      ...new Set(
        torrents
          .map((torrent) => stripSeason(torrent.save_path || ''))
          .filter(Boolean),
      ),
    ].toSorted(),
    scanned: torrents.length,
    total: torrents.length,
  }
}
