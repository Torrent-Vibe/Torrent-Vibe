import type {
  SessionTokenSummary,
  TokenSourceSummary,
  TokenSourceType,
  TurnTokenSnapshot,
} from '@innei/message-engine'
import type {
  MessageEngineDevtoolsSnapshot,
  MessageEngineDevtoolsSource,
  MessageEngineTraceActivity,
  MessageEngineTraceRun,
} from '@innei/message-engine/devtools'
import type { AiCallSnapshot, AiTraceRun } from '@torrent-vibe/shared'

import { useTorrentAiTraceStore } from './store'

type CallTelemetry = {
  callIndex: number
  snapshot: AiCallSnapshot
  timestamp: number
}

type SourceAggregate = Omit<TokenSourceSummary, 'percentage' | 'sourceType'>

const toFallbackTurnSnapshot = (
  run: AiTraceRun,
  call: CallTelemetry,
): TurnTokenSnapshot => {
  const totalTokens = call.snapshot.segments.reduce(
    (total, segment) => total + segment.tokens,
    0,
  )
  const segments = call.snapshot.segments.map((segment, index) => ({
    accuracy: 'estimated' as const,
    cacheScope: segment.injected ? ('turn' as const) : ('session' as const),
    cacheStatus: segment.cached
      ? ('provider-cache-read' as const)
      : ('eligible' as const),
    characters: segment.tokens * 4,
    contentDigest: `${run.runId}:${call.callIndex}:${index}:${segment.source}`,
    framingType: segment.injected
      ? `contribution:${segment.source}`
      : `message:${segment.source}`,
    ...(segment.messageId ? { messageId: segment.messageId } : {}),
    moduleId: 'torrent-ai',
    percentage: totalTokens === 0 ? 0 : segment.tokens / totalTokens,
    processorId: segment.source,
    segmentId: `${run.runId}:${call.callIndex}:${index}`,
    sourceType: segment.source,
    tokens: segment.tokens,
  }))
  const providerPromptTokens = call.snapshot.usage
    ? call.snapshot.usage.input + call.snapshot.usage.cacheRead
    : 0

  return {
    cache: {
      internalPrefixReuseRatio:
        totalTokens === 0 ? 0 : call.snapshot.unchangedTokens / totalTokens,
      ...(providerPromptTokens > 0 && call.snapshot.usage
        ? {
            providerCacheHitRate:
              call.snapshot.usage.cacheRead / providerPromptTokens,
            uncachedInputTokens: call.snapshot.usage.input,
          }
        : {}),
    },
    createdAt: call.timestamp,
    generation: call.callIndex,
    runtime: {
      model: run.model,
      provider: run.provider,
    },
    segments,
    sessionId: run.sessionId,
    totalCharacters: segments.reduce(
      (total, segment) => total + segment.characters,
      0,
    ),
    totalTokens,
    turnId: `${run.sessionId}:${call.callIndex}`,
    ...(call.snapshot.usage
      ? {
          usage: {
            cacheReadTokens: call.snapshot.usage.cacheRead,
            cacheWriteTokens: call.snapshot.usage.cacheWrite,
            inputTokens: call.snapshot.usage.input,
            outputTokens: call.snapshot.usage.output,
            ...(call.snapshot.usage.reasoning == null
              ? {}
              : { reasoningTokens: call.snapshot.usage.reasoning }),
          },
        }
      : {}),
  }
}

const collectTurns = (run: AiTraceRun): TurnTokenSnapshot[] => {
  const calls = new Map<number, CallTelemetry>()
  for (const event of run.events) {
    if (event.type !== 'call_compiled' && event.type !== 'call_usage') {
      continue
    }
    calls.set(event.callIndex, {
      callIndex: event.callIndex,
      snapshot: event.snapshot,
      timestamp: event.ts,
    })
  }

  return [...calls.values()]
    .sort((left, right) => left.callIndex - right.callIndex)
    .map(
      (call) =>
        call.snapshot.tokenSnapshot ?? toFallbackTurnSnapshot(run, call),
    )
}

const toSessionSummary = (
  run: AiTraceRun,
  turns: readonly TurnTokenSnapshot[],
): SessionTokenSummary => {
  const aggregates = new Map<TokenSourceType, SourceAggregate>()
  let totalCacheReadTokens = 0
  let totalCacheWriteTokens = 0
  let totalCost = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalTokens = 0

  for (const turn of turns) {
    totalCacheReadTokens += turn.usage?.cacheReadTokens ?? 0
    totalCacheWriteTokens += turn.usage?.cacheWriteTokens ?? 0
    totalCost += turn.cost?.total ?? 0
    totalInputTokens += turn.usage?.inputTokens ?? 0
    totalOutputTokens += turn.usage?.outputTokens ?? 0
    totalTokens += turn.totalTokens

    for (const segment of turn.segments) {
      const aggregate = aggregates.get(segment.sourceType) ?? {
        characters: 0,
        cost: 0,
        tokens: 0,
      }
      aggregate.characters += segment.characters
      aggregate.cost += segment.estimatedCost ?? 0
      aggregate.tokens += segment.tokens
      aggregates.set(segment.sourceType, aggregate)
    }
  }

  const providerInputTokens = totalInputTokens + totalCacheReadTokens
  const prefixViolations = run.events.filter(
    (event) => event.type === 'cache_broke',
  ).length
  const sources = [...aggregates.entries()]
    .map(([sourceType, aggregate]) => ({
      ...aggregate,
      percentage: totalTokens === 0 ? 0 : aggregate.tokens / totalTokens,
      sourceType,
    }))
    .sort((left, right) => right.tokens - left.tokens)

  return {
    ...(providerInputTokens > 0
      ? {
          averageProviderCacheHitRate:
            totalCacheReadTokens / providerInputTokens,
        }
      : {}),
    generations: turns.length,
    instanceId: `torrent-ai:${run.runId}`,
    prefixViolations,
    sessionId: run.sessionId,
    sources,
    totalCacheReadTokens,
    totalCacheWriteTokens,
    totalCost,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    turns: [...turns],
  }
}

const collectActivities = (
  run: AiTraceRun,
  turns: readonly TurnTokenSnapshot[],
): MessageEngineTraceActivity[] => {
  const activities: MessageEngineTraceActivity[] = []
  const tools = new Map<string, MessageEngineTraceActivity>()
  const turnIds = new Map(
    turns.map((turn) => [turn.generation, turn.turnId] as const),
  )

  for (const event of run.events) {
    const turnId =
      'callIndex' in event ? turnIds.get(event.callIndex) : undefined
    if (event.type === 'cache_broke') {
      activities.push({
        detail: [event.processorId, event.reason].filter(Boolean).join(' · '),
        id: `cache:${event.callIndex}:${event.ts}`,
        kind: 'error',
        label: 'Prefix cache invalidated',
        status: 'warning',
        timestamp: event.ts,
        ...(turnId ? { turnId } : {}),
      })
      continue
    }
    if (event.type === 'tool_start') {
      const activity: MessageEngineTraceActivity = {
        detail: event.argsPreview,
        id: `tool:${event.toolCallId}`,
        kind: 'tool',
        label: event.toolName,
        status: 'pending',
        timestamp: event.ts,
        ...(turnId ? { turnId } : {}),
      }
      activities.push(activity)
      tools.set(event.toolCallId, activity)
      continue
    }
    if (event.type === 'tool_end') {
      const existing = tools.get(event.toolCallId)
      if (existing) {
        existing.detail = event.resultPreview
        existing.durationMs = event.durationMs
        existing.status = event.isError ? 'error' : 'success'
        continue
      }
      activities.push({
        detail: event.resultPreview,
        durationMs: event.durationMs,
        id: `tool:${event.toolCallId}`,
        kind: 'tool',
        label: event.toolName,
        status: event.isError ? 'error' : 'success',
        timestamp: event.ts,
        ...(turnId ? { turnId } : {}),
      })
      continue
    }
    if (event.type === 'retry_scheduled') {
      activities.push({
        detail: `${event.attempt}/${event.maxAttempts} · ${event.errorMessage}`,
        durationMs: event.delayMs,
        id: `retry:${event.callIndex}:${event.attempt}:scheduled`,
        kind: 'retry',
        label: 'Retry scheduled',
        status: 'warning',
        timestamp: event.ts,
        ...(turnId ? { turnId } : {}),
      })
      continue
    }
    if (event.type === 'retry_attempt') {
      activities.push({
        detail: `Attempt ${event.attempt}`,
        id: `retry:${event.callIndex}:${event.attempt}:started`,
        kind: 'retry',
        label: 'Retry started',
        timestamp: event.ts,
        ...(turnId ? { turnId } : {}),
      })
      continue
    }
    if (event.type === 'rate_limit') {
      const detail = [
        event.retryAfterMs == null
          ? null
          : `retry after ${event.retryAfterMs}ms`,
        event.remaining == null ? null : `remaining ${event.remaining}`,
        event.reset == null ? null : `reset ${event.reset}`,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' · ')
      activities.push({
        detail,
        id: `rate-limit:${event.callIndex}:${event.ts}`,
        kind: 'rate-limit',
        label: 'Rate limit observed',
        status: 'warning',
        timestamp: event.ts,
        ...(turnId ? { turnId } : {}),
      })
    }
  }

  return activities.sort((left, right) => left.timestamp - right.timestamp)
}

export const toMessageEngineTraceRun = (
  run: AiTraceRun,
): MessageEngineTraceRun => {
  const turns = collectTurns(run)
  const runEnd = [...run.events]
    .reverse()
    .find((event) => event.type === 'run_end')
  const prefixMutations = run.events.flatMap((event) =>
    event.type === 'cache_broke' && event.mutation ? [event.mutation] : [],
  )

  let status: MessageEngineTraceRun['status'] = 'running'
  if (run.ok === true) {
    status = 'success'
  } else if (run.ok === false) {
    status = 'error'
  }

  return {
    activities: collectActivities(run, turns),
    ...(run.endedAt == null ? {} : { endedAt: run.endedAt }),
    ...(runEnd?.type === 'run_end' && runEnd.error
      ? { error: runEnd.error }
      : {}),
    model: run.model,
    prefixMutations,
    provider: run.provider,
    sessionId: run.sessionId,
    startedAt: run.startedAt,
    status,
    subtitle: run.hash ? `INFO HASH ${run.hash}` : undefined,
    summary: toSessionSummary(run, turns),
    title: run.rawName || run.runId,
  }
}

let cachedState = useTorrentAiTraceStore.getState()
let cachedSnapshot: MessageEngineDevtoolsSnapshot = {
  runs: cachedState.runOrder.flatMap((runId) => {
    const run = cachedState.runs[runId]
    return run ? [toMessageEngineTraceRun(run)] : []
  }),
  version: 1,
}

const getSnapshot = (): MessageEngineDevtoolsSnapshot => {
  const state = useTorrentAiTraceStore.getState()
  if (state === cachedState) {
    return cachedSnapshot
  }
  cachedState = state
  cachedSnapshot = {
    runs: state.runOrder.flatMap((runId) => {
      const run = state.runs[runId]
      return run ? [toMessageEngineTraceRun(run)] : []
    }),
    version: 1,
  }
  return cachedSnapshot
}

export const torrentAiTraceDevtoolsSource: MessageEngineDevtoolsSource = {
  getSnapshot,
  subscribe: (listener) => useTorrentAiTraceStore.subscribe(listener),
}
