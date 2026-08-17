import type {
  AiCallSegment,
  AiCallSnapshot,
  AiTraceEvent,
} from '@torrent-vibe/shared'
import { AI_CALL_SOURCE_COLORS } from '@torrent-vibe/shared'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip/Tooltip'
import { useIsDark } from '~/hooks/common'

import {
  buildPrefixCacheLayout,
  detectCacheHint,
  formatTraceTokens,
} from '../cache-geometry'
import {
  CallStats,
  NestedEvent,
  PrefixCacheUnderline,
} from './TorrentAiTraceCallMeta'

const collectToolCallIds = (events: AiTraceEvent[]): string[] => {
  const ids: string[] = []
  for (const event of events) {
    if (event.type !== 'tool_start' && event.type !== 'tool_end') {
      continue
    }
    if (!ids.includes(event.toolCallId)) {
      ids.push(event.toolCallId)
    }
  }
  return ids
}

const bindToolSegments = (
  segments: AiCallSegment[],
  toolCallIds: string[],
): Array<AiCallSegment & { toolCallId?: string }> => {
  let callCursor = 0
  let resultCursor = 0
  return segments.map((segment) => {
    if (segment.source === 'tool-call') {
      return { ...segment, toolCallId: toolCallIds[callCursor++] }
    }
    if (segment.source === 'tool-result') {
      return { ...segment, toolCallId: toolCallIds[resultCursor++] }
    }
    return segment
  })
}

export const TorrentAiTraceCallRow = ({
  callIndex,
  snapshot,
  previous,
  events,
  windowTokens,
  hoverToolCallId,
  onHoverTool,
}: {
  callIndex: number
  snapshot?: AiCallSnapshot
  previous?: AiCallSnapshot
  events: AiTraceEvent[]
  windowTokens: number
  hoverToolCallId: string | null
  onHoverTool: (toolCallId: string | null) => void
}) => {
  const isDark = useIsDark()
  const bound = bindToolSegments(
    snapshot?.segments ?? [],
    collectToolCallIds(events),
  )
  const layout = snapshot
    ? buildPrefixCacheLayout(
        snapshot,
        bound.map((segment) => ({ ...segment, covered: 'none' })),
      )
    : null
  const tokens = layout?.visualTokens ?? snapshot?.totalTokens ?? 0
  const width = tokens > 0 ? (tokens / windowTokens) * 100 : 8
  const segments = (layout?.segments ?? []).map((segment, index, list) => {
    const previousSegment = index === 0 ? undefined : list[index - 1]
    return {
      ...segment,
      boundary:
        Boolean(segment.messageId) &&
        segment.messageId !== previousSegment?.messageId,
      displayCached: snapshot?.usage
        ? segment.covered === 'full'
        : segment.cached,
    }
  })
  const hint = detectCacheHint({ callIndex, snapshot, previous })

  return (
    <div className="flex gap-3">
      <div className="w-[7.5rem] shrink-0 pt-0.5">
        <p className="text-xs font-medium text-text">{`Call ${callIndex}`}</p>
        <p className="text-[11px] tabular-nums text-text-tertiary">
          {`${formatTraceTokens(tokens)} · ${Math.round((tokens / windowTokens) * 100)}%`}
        </p>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div>
          <div className="h-7 overflow-hidden rounded-md bg-fill-quaternary">
            <div
              className="flex h-full overflow-hidden"
              style={{ width: `${width}%` }}
            >
              {segments.map((segment) => {
                const color = AI_CALL_SOURCE_COLORS[segment.source]
                const share = tokens > 0 ? (segment.tokens / tokens) * 100 : 0
                const hovered = Boolean(hoverToolCallId)
                const matched =
                  hovered &&
                  (segment.toolCallId
                    ? segment.toolCallId === hoverToolCallId
                    : segment.source === 'tool-call' ||
                      segment.source === 'tool-result')
                const dimmed = hovered && !matched
                const key = [
                  callIndex,
                  segment.source,
                  segment.toolCallId ?? segment.messageId ?? 'anon',
                  segment.tokens,
                  segment.displayCached ? 'c' : 'u',
                ].join('-')
                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <div
                        className="relative h-full transition-opacity duration-150"
                        style={{
                          width: `${Math.max(share, 0.4)}%`,
                          backgroundColor: color,
                          opacity: dimmed
                            ? 0.18
                            : matched
                              ? 1
                              : segment.displayCached
                                ? 0.45
                                : 1,
                          outline: matched
                            ? `1px solid ${isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)'}`
                            : undefined,
                          outlineOffset: matched ? -1 : undefined,
                          backgroundImage: segment.displayCached
                            ? undefined
                            : `repeating-linear-gradient(45deg, transparent, transparent 3px, ${isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.16)'} 3px, ${isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.16)'} 5px)`,
                          boxShadow: segment.boundary
                            ? `inset 1px 0 0 ${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)'}`
                            : undefined,
                        }}
                      >
                        {segment.injected ? (
                          <span className="absolute top-0 right-0 flex size-2.5 items-center justify-center rounded-sm bg-orange text-[8px] leading-none text-white">
                            i
                          </span>
                        ) : null}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs" side="top">
                      {`${segment.source} · ${formatTraceTokens(segment.tokens)}${segment.displayCached ? ' · cached' : ''}`}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>
          {layout ? (
            <PrefixCacheUnderline barWidthPercent={width} layout={layout} />
          ) : (
            <div className="h-2" />
          )}
        </div>
        <CallStats events={events} hint={hint} snapshot={snapshot} />
        <div className="space-y-0.5">
          {events.map((event) => (
            <NestedEvent
              event={event}
              key={`${event.type}-${event.ts}-${'toolCallId' in event ? event.toolCallId : event.runId}`}
              active={
                (event.type === 'tool_start' || event.type === 'tool_end') &&
                event.toolCallId === hoverToolCallId
              }
              onHover={onHoverTool}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
