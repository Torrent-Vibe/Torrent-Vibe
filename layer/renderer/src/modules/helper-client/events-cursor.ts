import type { HelperEvent } from '@torrent-vibe/helper-protocol'

export const MAX_HELD_HELPER_EVENTS = 2000

export const mergeEventsPage = (
  held: HelperEvent[],
  page: HelperEvent[],
): HelperEvent[] => {
  if (page.length === 0) {
    return held
  }
  const seen = new Set(held.map((entry) => entry.seq))
  const maxHeldSeq = held.reduce((max, entry) => Math.max(max, entry.seq), 0)
  const additions = page.filter(
    (entry) => entry.seq > maxHeldSeq && !seen.has(entry.seq),
  )
  if (additions.length === 0) {
    return held
  }
  const merged = [...held, ...additions]
  return merged.length > MAX_HELD_HELPER_EVENTS
    ? merged.slice(merged.length - MAX_HELD_HELPER_EVENTS)
    : merged
}
