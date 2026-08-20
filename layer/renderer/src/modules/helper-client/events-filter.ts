import type { HelperEvent } from '@torrent-vibe/helper-protocol'

export const HELPER_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
export type HelperLogLevel = (typeof HELPER_LOG_LEVELS)[number]

export const DEFAULT_HELPER_LOG_LEVEL: HelperLogLevel = 'info'

const LEVEL_RANK: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export interface HelperEventsFilter {
  level: HelperLogLevel
  search?: string
}

const searchHaystack = (event: HelperEvent): string =>
  [
    event.message,
    event.kind,
    event.replicaId,
    event.bangumiId,
    event.subgroupId,
    event.episodeId,
    event.fields ? JSON.stringify(event.fields) : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase()

export const filterHelperEvents = (
  events: HelperEvent[],
  filter: HelperEventsFilter,
): HelperEvent[] => {
  const minRank =
    LEVEL_RANK[filter.level] ?? LEVEL_RANK[DEFAULT_HELPER_LOG_LEVEL]
  const needle = filter.search?.trim().toLowerCase()
  return events.filter((event) => {
    if ((LEVEL_RANK[event.level] ?? 0) < minRank) {
      return false
    }
    if (needle && !searchHaystack(event).includes(needle)) {
      return false
    }
    return true
  })
}
