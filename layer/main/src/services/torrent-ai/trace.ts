import type { TurnTokenSnapshot } from '@innei/message-engine'
import type {
  AiCallSegment,
  AiCallSnapshot,
  AiTraceEvent,
  AiTraceExport,
  AiTraceExportCall,
  AiTraceExportInvocation,
  AiTraceExportPrompt,
  AiTraceExportTool,
  AiTraceRun,
} from '@torrent-vibe/shared'
import {
  AI_TRACE_EVENTS_PER_RUN,
  AI_TRACE_RUN_LIMIT,
  isAiCallSource,
} from '@torrent-vibe/shared'

import { getLogger } from '~/config/log-config'
import { BridgeService } from '~/services/bridge-service'

export interface AiTraceExportInit {
  prompt: AiTraceExportPrompt
  tools: AiTraceExportTool[]
}

export interface AiTraceSink {
  addCompiledCall: (runId: string, call: AiTraceExportCall) => void
  addInvocation: (runId: string, invocation: AiTraceExportInvocation) => void
  emit: (event: AiTraceEvent) => void
  getExport: (runId: string) => AiTraceExport | null
  getSnapshot: () => { runs: AiTraceRun[] }
  initExport: (runId: string, init: AiTraceExportInit) => void
  setBroadcastEnabled: (enabled: boolean) => void
  setExportMessages: (runId: string, messages: unknown[]) => void
}

const INJECTED_PROCESSORS = new Set([
  'torrent-ai.skill-catalog',
  'torrent-ai.file-tree',
])

const BOOKEND_TYPES = new Set(['run_start', 'run_end'])

const logger = getLogger('[torrent-ai.trace]')

let instance: AiTraceSink | null = null

const formatTokens = (value: number): string => {
  if (value >= 1000) {
    const scaled = value / 1000
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 1
    return `${scaled.toFixed(digits).replace(/\.0$/, '')}k`
  }
  return String(value)
}

const formatSeconds = (ms: number): string => {
  const seconds = ms / 1000
  return `${seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2)}s`
}

const isDev = process.env.NODE_ENV === 'development'

const toCallSegment = (
  segment: TurnTokenSnapshot['segments'][number],
): AiCallSegment => {
  const source = isAiCallSource(segment.sourceType)
    ? segment.sourceType
    : 'unattributed'
  const cached =
    segment.cacheStatus === 'reused-internally' ||
    segment.cacheStatus === 'provider-cache-read'
  const injected =
    segment.cacheScope === 'turn' ||
    INJECTED_PROCESSORS.has(segment.processorId)
  const next: AiCallSegment = {
    source,
    tokens: segment.tokens,
    cached,
    injected,
  }
  if (segment.messageId) {
    next.messageId = segment.messageId
  }
  return next
}

export const projectTurnSnapshot = (
  snapshot: TurnTokenSnapshot,
  extras?: {
    callIndex?: number
    cacheBroke?: boolean
    brokeAt?: string
  },
): AiCallSnapshot => {
  const systemParts: AiCallSegment[] = []
  const rest: AiCallSegment[] = []
  const seenSystemDigests = new Set<string>()

  const prefixParts: AiCallSegment[] = []

  for (const segment of snapshot.segments) {
    if (
      segment.processorId === 'raw-message' &&
      segment.messageId?.startsWith('injected:stable-prefix:')
    ) {
      continue
    }

    const mapped = toCallSegment(segment)
    if (mapped.source === 'system') {
      if (seenSystemDigests.has(segment.contentDigest)) {
        continue
      }
      seenSystemDigests.add(segment.contentDigest)
      systemParts.push(mapped)
      continue
    }
    if (segment.framingType.startsWith('contribution:stable-prefix')) {
      prefixParts.push(mapped)
      continue
    }
    rest.push(mapped)
  }

  const segments = [...systemParts, ...prefixParts, ...rest]

  const cacheHitTokens = segments.reduce(
    (sum, segment) => (segment.cached ? sum + segment.tokens : sum),
    0,
  )
  const reprocessedTokens = segments.reduce(
    (sum, segment) => (segment.cached ? sum : sum + segment.tokens),
    0,
  )
  const unchangedTokens = snapshot.segments.reduce((sum, segment) => {
    if (segment.cacheStatus === 'reused-internally') {
      return sum + segment.tokens
    }
    return sum
  }, 0)

  const projected: AiCallSnapshot = {
    callIndex: extras?.callIndex ?? 0,
    totalTokens: segments.reduce((sum, segment) => sum + segment.tokens, 0),
    cacheHitTokens,
    reprocessedTokens,
    unchangedTokens,
    cacheBroke: extras?.cacheBroke === true,
    segments,
  }
  if (extras?.brokeAt) {
    projected.brokeAt = extras.brokeAt
  }
  if (snapshot.usage) {
    projected.usage = {
      input: snapshot.usage.inputTokens,
      output: snapshot.usage.outputTokens,
      cacheRead: snapshot.usage.cacheReadTokens ?? 0,
      cacheWrite: snapshot.usage.cacheWriteTokens ?? 0,
      ...(snapshot.usage.reasoningTokens == null
        ? {}
        : { reasoning: snapshot.usage.reasoningTokens }),
    }
  }
  return projected
}

const annotateCall = (snapshot: AiCallSnapshot): string => {
  if (snapshot.cacheBroke) {
    const at = snapshot.brokeAt ? ` at ${snapshot.brokeAt}` : ''
    return `cache broke${at}  reprocess ${formatTokens(snapshot.reprocessedTokens)}`
  }
  if (snapshot.cacheHitTokens > 0 && snapshot.reprocessedTokens === 0) {
    return `cache hit ${formatTokens(snapshot.cacheHitTokens)}`
  }
  if (snapshot.cacheHitTokens > 0) {
    return `cache hit ${formatTokens(snapshot.cacheHitTokens)}`
  }
  return 'cold start'
}

const formatLogLine = (event: AiTraceEvent): string | null => {
  switch (event.type) {
    case 'run_start': {
      return `▶ run ${event.runId}  ${event.rawName}  provider=${event.provider} model=${event.model}`
    }
    case 'call_compiled':
    case 'call_usage': {
      return `  call ${event.callIndex}  ${formatTokens(event.snapshot.totalTokens)}  ${annotateCall(event.snapshot)}`
    }
    case 'cache_broke': {
      return `  cache broke  call ${event.callIndex}  ${event.processorId ?? event.reason}`
    }
    case 'tool_start': {
      return `  tool ▶ ${event.toolName}  ${event.argsPreview}`
    }
    case 'tool_end': {
      return `  tool ■ ${event.toolName}  ${event.durationMs}ms  ${event.isError ? 'error' : 'ok'}`
    }
    case 'retry_scheduled': {
      return `  retry scheduled  ${event.attempt}/${event.maxAttempts}  wait ${event.delayMs}ms  ${event.errorMessage}`
    }
    case 'retry_attempt': {
      return `  retry attempt  ${event.attempt}`
    }
    case 'rate_limit': {
      const parts = [
        event.retryAfterMs == null
          ? null
          : `retry-after ${event.retryAfterMs}ms`,
        event.remaining == null ? null : `remaining ${event.remaining}`,
        event.reset == null ? null : `reset ${event.reset}`,
      ].filter(Boolean)
      return `  rate limit  ${parts.join('  ')}`
    }
    case 'run_end': {
      const result = event.ok ? 'ok' : 'fail'
      const extra = [
        event.mediaType,
        event.confidence == null
          ? null
          : `confidence=${event.confidence.toFixed(2)}`,
        event.error,
      ].filter(Boolean)
      return `■ run ${event.runId}  ${result}  ${formatSeconds(event.durationMs)}${extra.length > 0 ? `  ${extra.join('  ')}` : ''}`
    }
    default: {
      return null
    }
  }
}

const applyEventToRun = (run: AiTraceRun, event: AiTraceEvent): void => {
  run.events.push(event)
  if (run.events.length > AI_TRACE_EVENTS_PER_RUN) {
    const index = run.events.findIndex((item) => !BOOKEND_TYPES.has(item.type))
    if (index >= 0) {
      run.events.splice(index, 1)
    } else {
      run.events.shift()
    }
  }

  if (event.type === 'run_end') {
    run.endedAt = event.ts
    run.ok = event.ok
  }
}

const createRunFromEvent = (event: AiTraceEvent): AiTraceRun => {
  if (event.type === 'run_start') {
    return {
      runId: event.runId,
      sessionId: event.sessionId,
      rawName: event.rawName,
      ...(event.hash ? { hash: event.hash } : {}),
      provider: event.provider,
      model: event.model,
      startedAt: event.ts,
      events: [event],
    }
  }
  return {
    runId: event.runId,
    sessionId: event.runId,
    rawName: '',
    provider: '',
    model: '',
    startedAt: event.ts,
    events: [event],
  }
}

export const getAiTraceSink = (): AiTraceSink => {
  if (instance) {
    return instance
  }

  const runs = new Map<string, AiTraceRun>()
  type ExportDraft = {
    prompt: AiTraceExportPrompt
    tools: AiTraceExportTool[]
    invocations: AiTraceExportInvocation[]
    compiledByCall: AiTraceExportCall[]
    messages: unknown[]
  }
  const exports = new Map<string, ExportDraft>()
  const order: string[] = []
  let broadcastEnabled = isDev

  const evict = (runId: string) => {
    runs.delete(runId)
    exports.delete(runId)
  }

  const ensureExport = (runId: string) => {
    const existing = exports.get(runId)
    if (existing) {
      return existing
    }
    const created: ExportDraft = {
      prompt: {
        system: '',
        user: '',
        fileTree: null,
        skillCatalog: '',
      },
      tools: [],
      invocations: [],
      compiledByCall: [],
      messages: [],
    }
    exports.set(runId, created)
    return created
  }

  const emit = (event: AiTraceEvent) => {
    let run = runs.get(event.runId)
    if (!run) {
      run = createRunFromEvent(event)
      runs.set(event.runId, run)
      order.push(event.runId)
      while (order.length > AI_TRACE_RUN_LIMIT) {
        const evicted = order.shift()
        if (evicted) {
          evict(evicted)
        }
      }
    } else {
      applyEventToRun(run, event)
    }

    if (isDev || broadcastEnabled) {
      const line = formatLogLine(event)
      if (line) {
        logger.debug(line)
      }
    }

    if (broadcastEnabled) {
      try {
        BridgeService.shared.broadcast('torrent-ai:trace', event)
      } catch {}
    }
  }

  instance = {
    emit,
    setBroadcastEnabled: (enabled: boolean) => {
      broadcastEnabled = enabled
    },
    getSnapshot: () => ({
      runs: order
        .map((id) => runs.get(id))
        .filter((run): run is AiTraceRun => Boolean(run)),
    }),
    initExport: (runId, init) => {
      const draft = ensureExport(runId)
      draft.prompt = init.prompt
      draft.tools = init.tools
    },
    addCompiledCall: (runId, call) => {
      const draft = ensureExport(runId)
      draft.compiledByCall.push(call)
      draft.prompt.compiledSystem = call.systemPrompt
    },
    addInvocation: (runId, invocation) => {
      const draft = ensureExport(runId)
      const existing = draft.invocations.find(
        (item) => item.toolCallId === invocation.toolCallId,
      )
      if (existing) {
        existing.callIndex = invocation.callIndex
        existing.toolName = invocation.toolName
        if (invocation.args !== undefined) {
          existing.args = invocation.args
        }
        if (invocation.result !== undefined) {
          existing.result = invocation.result
        }
        if (invocation.isError !== undefined) {
          existing.isError = invocation.isError
        }
        if (invocation.durationMs !== undefined) {
          existing.durationMs = invocation.durationMs
        }
        return
      }
      draft.invocations.push(invocation)
    },
    setExportMessages: (runId, messages) => {
      ensureExport(runId).messages = messages
    },
    getExport: (runId) => {
      const run = runs.get(runId)
      const draft = exports.get(runId)
      if (!run || !draft) {
        return null
      }
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        run,
        prompt: draft.prompt,
        tools: draft.tools,
        invocations: draft.invocations,
        compiledByCall: draft.compiledByCall,
        messages: draft.messages,
      }
    },
  }

  return instance
}
