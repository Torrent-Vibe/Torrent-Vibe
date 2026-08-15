import type {
  AiCallSnapshot,
  AiCallSource,
  AiTraceEvent,
  AiTraceRun,
} from '@torrent-vibe/shared'
import { AI_CALL_SOURCE_COLORS, AI_CALL_SOURCES } from '@torrent-vibe/shared'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { buildPrefixCacheLayout } from '../cache-geometry'
import { TorrentAiTraceCallRow } from './TorrentAiTraceCallRow'

const groupCalls = (run: AiTraceRun) => {
  const groups = new Map<
    number,
    { snapshot?: AiCallSnapshot, events: AiTraceEvent[] }
  >()
  for (const event of run.events) {
    if (event.type === 'run_start' || event.type === 'run_end') {
      continue
    }
    const current = groups.get(event.callIndex) ?? { events: [] }
    if (event.type === 'call_compiled' || event.type === 'call_usage') {
      current.snapshot = event.snapshot
    }
    else {
      current.events.push(event)
    }
    groups.set(event.callIndex, current)
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([callIndex, group]) => ({ callIndex, ...group }))
}

export const TorrentAiTraceChart = ({ run }: { run: AiTraceRun }) => {
  const { t } = useTranslation()
  const [hover, setHover] = useState<{
    callIndex: number
    toolCallId: string
  } | null>(null)
  const calls = useMemo(() => groupCalls(run), [run])
  const presentSources = useMemo(() => {
    const sources = new Set<AiCallSource>()
    for (const call of calls) {
      for (const segment of call.snapshot?.segments ?? []) {
        sources.add(segment.source)
      }
    }
    return sources
  }, [calls])
  const windowTokens = Math.max(
    1,
    ...calls.map(call =>
      call.snapshot ? buildPrefixCacheLayout(call.snapshot).visualTokens : 0),
  )

  if (calls.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-text-tertiary">
        {run.ok == null
          ? (
              <div className="h-7 w-full animate-pulse rounded-md bg-fill-quaternary" />
            )
          : (
              t('torrent.ai.trace.empty')
            )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {calls.map((call, index) => (
        <TorrentAiTraceCallRow
          key={call.callIndex}
          callIndex={call.callIndex}
          snapshot={call.snapshot}
          previous={index > 0 ? calls[index - 1]?.snapshot : undefined}
          events={call.events}
          windowTokens={windowTokens}
          hoverToolCallId={
            hover?.callIndex === call.callIndex ? hover.toolCallId : null
          }
          onHoverTool={(toolCallId) => {
            setHover(
              toolCallId ? { callIndex: call.callIndex, toolCallId } : null,
            )
          }}
        />
      ))}
      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-3 text-[11px] text-text-secondary">
        {AI_CALL_SOURCES.filter(source => presentSources.has(source)).map(
          source => (
            <span key={source} className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-[2px]"
                style={{ backgroundColor: AI_CALL_SOURCE_COLORS[source] }}
              />
              {source}
            </span>
          ),
        )}
      </div>
    </div>
  )
}
