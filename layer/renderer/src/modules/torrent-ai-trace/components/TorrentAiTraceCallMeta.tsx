import type { AiCallSnapshot, AiTraceEvent } from '@torrent-vibe/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip/Tooltip'
import { clsxm } from '~/lib/cn'

import type {
  CacheHintKind,
  detectCacheHint,
  PrefixCacheLayout,
} from '../cache-geometry'
import { formatTraceTokens } from '../cache-geometry'

const HINT_KEY: Record<CacheHintKind, I18nKeys> = {
  'near-floor': 'torrent.ai.trace.hintNearFloor',
  'missed-after-prefix': 'torrent.ai.trace.hintMissedAfterPrefix',
  'below-floor': 'torrent.ai.trace.hintBelowFloor',
  'page-remainder': 'torrent.ai.trace.hintPageRemainder',
}

const providerPromptTokens = (snapshot?: AiCallSnapshot) => {
  if (!snapshot?.usage) {
    return null
  }
  return snapshot.usage.input + snapshot.usage.cacheRead
}

const providerCacheHitPercent = (snapshot?: AiCallSnapshot): number | null => {
  const prompt = providerPromptTokens(snapshot)
  if (prompt == null || prompt <= 0 || !snapshot?.usage) {
    return null
  }
  return Math.round((snapshot.usage.cacheRead / prompt) * 100)
}

export const CallStats = ({
  snapshot,
  events,
  hint,
}: {
  snapshot?: AiCallSnapshot
  events: AiTraceEvent[]
  hint: ReturnType<typeof detectCacheHint>
}) => {
  const { t } = useTranslation()
  const retry = events.find(event => event.type === 'retry_scheduled')
  if (!snapshot) {
    return <p className="text-[11px] text-text-tertiary">tokens unknown</p>
  }

  const prompt = providerPromptTokens(snapshot)
  const percent = providerCacheHitPercent(snapshot)
  const cacheLabel
    = snapshot.usage && percent != null
      ? `cache ${formatTraceTokens(snapshot.usage.cacheRead)} ${percent}%`
      : 'cache —'
  const inputLabel
    = prompt == null
      ? `in ~${formatTraceTokens(snapshot.totalTokens)}`
      : `in ${formatTraceTokens(prompt)}`
  const outputLabel = snapshot.usage
    ? `out ${formatTraceTokens(snapshot.usage.output)}`
    : 'out —'

  const hintText = hint
    ? t(HINT_KEY[hint.kind], { tokens: formatTraceTokens(hint.tokens) })
    : null

  return (
    <div className="space-y-0.5">
      <p className="text-[11px] tabular-nums text-text-secondary">
        {`${cacheLabel} · ${inputLabel} · ${outputLabel}`}
      </p>
      {hintText
        ? (
            <p className="text-[11px] text-text-tertiary">{hintText}</p>
          )
        : null}
      {snapshot.cacheBroke
        ? (
            <p className="text-[11px] text-red">
              {`▲ cache broke${snapshot.brokeAt ? ` at ${snapshot.brokeAt}` : ''} — ${formatTraceTokens(snapshot.reprocessedTokens)} re-processed`}
            </p>
          )
        : null}
      {retry && retry.type === 'retry_scheduled'
        ? (
            <p className="text-[11px] text-orange">
              {`retry scheduled ${retry.delayMs}ms · ${retry.errorMessage}`}
            </p>
          )
        : null}
    </div>
  )
}

export const NestedEvent = ({
  event,
  active,
  onHover,
}: {
  event: AiTraceEvent
  active: boolean
  onHover: (toolCallId: string | null) => void
}) => {
  const [open, setOpen] = useState(false)
  const toolCallId
    = event.type === 'tool_start' || event.type === 'tool_end'
      ? event.toolCallId
      : null
  const className = clsxm(
    'block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] transition-colors duration-150',
    active
      ? 'bg-fill text-text'
      : 'text-text-secondary hover:bg-fill/60 hover:text-text',
  )

  if (event.type === 'tool_start' || event.type === 'tool_end') {
    const label
      = event.type === 'tool_start'
        ? open
          ? `↳ ${event.toolName} ${event.argsPreview}`
          : `↳ ${event.toolName}`
        : open
          ? `↳ ${event.toolName} ${event.durationMs}ms ${event.isError ? 'error' : 'ok'} ${event.resultPreview}`
          : `↳ ${event.toolName}  ${event.durationMs}ms  ${event.isError ? 'error' : 'ok'}`
    return (
      <button
        type="button"
        className={className}
        onClick={() => setOpen(value => !value)}
        onMouseEnter={() => onHover(toolCallId)}
        onMouseLeave={() => onHover(null)}
      >
        {label}
      </button>
    )
  }
  if (event.type === 'retry_scheduled') {
    return (
      <p className="px-1.5 text-[11px] text-orange">
        {`↳ retry scheduled  ${event.attempt}/${event.maxAttempts}  ${event.delayMs}ms`}
      </p>
    )
  }
  if (event.type === 'rate_limit') {
    return (
      <p className="px-1.5 text-[11px] text-text-tertiary">
        {`↳ rate limit${event.retryAfterMs == null ? '' : `  ${event.retryAfterMs}ms`}`}
      </p>
    )
  }
  return null
}

export const PrefixCacheUnderline = ({
  layout,
  barWidthPercent,
}: {
  layout: PrefixCacheLayout
  barWidthPercent: number
}) => {
  const { t } = useTranslation()
  if (layout.cacheRead <= 0 || layout.visualTokens <= 0) {
    return <div className="h-2" />
  }
  const width = (barWidthPercent * layout.underlineTokens) / layout.visualTokens
  return (
    <div className="relative mt-0.5 h-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute top-1 h-0.5 rounded-full bg-green"
            style={{ width: `${width}%` }}
          >
            <span className="absolute top-1/2 right-0 size-1.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-green" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {layout.remainderTokens > 0 && layout.remainderSource
            ? t('torrent.ai.trace.prefixRangePartial', {
                cached: formatTraceTokens(layout.cacheRead),
                percent: layout.percent,
                source: layout.lastCoveredSource ?? 'prefix',
                remain: formatTraceTokens(layout.remainderTokens),
                next: layout.remainderSource,
              })
            : t('torrent.ai.trace.prefixRange', {
                cached: formatTraceTokens(layout.cacheRead),
                percent: layout.percent,
                source: layout.lastCoveredSource ?? 'prefix',
              })}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
