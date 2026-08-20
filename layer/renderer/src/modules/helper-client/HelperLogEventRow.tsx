import type { HelperEvent } from '@torrent-vibe/helper-protocol'
import { useState } from 'react'

import { cn } from '~/lib/cn'

const LEVEL_DOT_CLASS: Record<string, string> = {
  debug: 'bg-text-tertiary',
  info: 'bg-blue',
  warn: 'bg-yellow',
  error: 'bg-red',
}

export const HelperLogEventRow = ({ event }: { event: HelperEvent }) => {
  const [expanded, setExpanded] = useState(false)
  const hasFields = Boolean(
    event.fields && Object.keys(event.fields).length > 0,
  )

  return (
    <div className="border-b border-border/60 px-2 py-1.5 text-xs">
      <button
        type="button"
        className={cn(
          'flex w-full items-start gap-2 text-left',
          hasFields ? 'cursor-pointer' : 'cursor-default',
        )}
        onClick={() => hasFields && setExpanded((value) => !value)}
      >
        <span
          className={cn(
            'mt-1 size-1.5 shrink-0 rounded-full',
            LEVEL_DOT_CLASS[event.level] ?? 'bg-text-tertiary',
          )}
        />
        <span className="shrink-0 text-text-tertiary tabular-nums">
          {event.at}
        </span>
        <span className="shrink-0 font-medium text-text-secondary">
          {event.kind}
        </span>
        <span className="min-w-0 flex-1 truncate text-text">
          {event.message}
        </span>
        {hasFields && (
          <i
            className={cn(
              'i-mingcute-down-line mt-0.5 shrink-0 text-sm text-text-tertiary transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          />
        )}
      </button>
      {expanded && hasFields && (
        <pre className="mt-1 ml-4 overflow-x-auto rounded bg-fill-secondary/60 p-2 text-[11px] text-text-secondary">
          {JSON.stringify(event.fields, null, 2)}
        </pre>
      )}
    </div>
  )
}
