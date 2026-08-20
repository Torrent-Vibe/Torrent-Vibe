import type { HelperEvent } from '@torrent-vibe/helper-protocol'
import { useEffect, useState } from 'react'

import { getHelperEvents } from './events-api'
import { mergeEventsPage } from './events-cursor'
import { createHelperEventsPolling } from './events-polling'

export interface UseHelperEventsFeedInput {
  baseUrl: string
  replicaId?: string
  token: string
}

export const useHelperEventsFeed = ({
  baseUrl,
  token,
  replicaId,
}: UseHelperEventsFeedInput): HelperEvent[] => {
  const [events, setEvents] = useState<HelperEvent[]>([])

  useEffect(() => {
    setEvents([])
    const controller = createHelperEventsPolling({
      fetchPage: (since) =>
        getHelperEvents(baseUrl, token, {
          since,
          ...(replicaId ? { replicaId } : {}),
        }),
      onPage: (page) => {
        setEvents((current) => mergeEventsPage(current, page.events))
      },
    })
    controller.start()
    return () => controller.stop()
  }, [baseUrl, token, replicaId])

  return events
}
