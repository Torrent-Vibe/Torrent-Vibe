import type { HelperEvent } from '@torrent-vibe/helper-protocol'

const formatHelperEventLine = (event: HelperEvent): string => {
  const parts = [event.at, `[${event.level}]`, event.kind, event.message]
  if (event.fields) {
    parts.push(JSON.stringify(event.fields))
  }
  return parts.join(' ')
}

export const formatHelperEventsForCopy = (events: HelperEvent[]): string =>
  events.map(formatHelperEventLine).join('\n')
