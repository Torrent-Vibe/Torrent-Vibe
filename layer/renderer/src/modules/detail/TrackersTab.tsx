import { m } from 'motion/react'

import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import { cn } from '~/lib/cn'
import { Spring } from '~/lib/spring'
import type { TorrentTracker } from '~/types/torrent'

interface TrackersTabProps {
  trackers?: TorrentTracker[]
  isLoading?: boolean
}

const getTrackerStatus = (status: number) => {
  switch (status) {
    case 2: {
      return { text: 'Working', color: 'text-green', bgColor: 'bg-green' }
    }
    case 3: {
      return {
        text: 'Not contacted',
        color: 'text-text-secondary',
        bgColor: 'bg-fill-quaternary',
      }
    }
    case 4: {
      return { text: 'Error', color: 'text-red', bgColor: 'bg-red' }
    }
    default: {
      return {
        text: 'Unknown',
        color: 'text-text-secondary',
        bgColor: 'bg-fill-quaternary',
      }
    }
  }
}

export const TrackersTab = ({ trackers, isLoading }: TrackersTabProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <i className="i-mingcute-loading-3-line animate-spin text-accent size-8" />
      </div>
    )
  }

  if (!trackers?.length) {
    return (
      <div className="text-sm text-text-secondary text-center p-6 flex flex-col items-center gap-2">
        <i className="i-mingcute-radar-line text-2xl text-accent size-8" />
        No trackers available
      </div>
    )
  }
  return (
    <ScrollArea flex rootClassName="-mx-4 -mb-4" viewportClassName="px-4 pb-4">
      {trackers?.map((tracker, i) => {
        const statusInfo = getTrackerStatus(tracker.status)
        return (
          <m.div
            key={tracker.url}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-fill-secondary/30 transition-colors border border-transparent hover:border-separator"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={Spring.smooth(0.4, i * 0.05)}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <m.div
                className={cn(
                  'w-3 h-3 rounded-full shadow-sm',
                  statusInfo.bgColor,
                )}
                animate={{ scale: tracker.status === 2 ? [1, 1.2, 1] : 1 }}
                transition={{
                  duration: 2,
                  repeat: tracker.status === 2 ? Infinity : 0,
                  ease: 'easeInOut',
                }}
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-medium text-text truncate"
                  title={tracker.url}
                >
                  {tracker.url.replace(/^https?:\/\//, '')}
                </div>
                <div className="flex items-center gap-2 text-xs text-text-secondary mt-1">
                  <span>Seeds: {tracker.num_seeds}</span>
                  <span>•</span>
                  <span>Peers: {tracker.num_peers}</span>
                </div>
              </div>
            </div>
            <span
              className={cn(
                'text-xs font-medium px-2 py-1 rounded bg-material-thin',
                statusInfo.color,
              )}
            >
              {statusInfo.text}
            </span>
          </m.div>
        )
      })}
    </ScrollArea>
  )
}
