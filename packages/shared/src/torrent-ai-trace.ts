import type {
  PrefixMutationEvent,
  TurnTokenSnapshot,
} from '@innei/message-engine'

export const AI_TRACE_PREVIEW_LIMIT = 2048
export const AI_TRACE_RUN_LIMIT = 20
export const AI_TRACE_EVENTS_PER_RUN = 400

export const truncateAiTracePreview = (value: unknown): string => {
  let text: string
  if (typeof value === 'string') {
    text = value
  } else {
    try {
      text = JSON.stringify(value) ?? String(value)
    } catch {
      text = String(value)
    }
  }
  if (text.length <= AI_TRACE_PREVIEW_LIMIT) {
    return text
  }
  return `${text.slice(0, AI_TRACE_PREVIEW_LIMIT)}…`
}

export const AI_CALL_SOURCES = [
  'system',
  'user',
  'assistant',
  'tool-call',
  'tool-result',
  'tool-schema',
  'skill',
  'document',
  'runtime-state',
  'knowledge',
  'memory',
  'history-summary',
  'message-overhead',
  'unattributed',
] as const

export type AiCallSource = (typeof AI_CALL_SOURCES)[number]

export const AI_CALL_SOURCE_COLORS: Record<AiCallSource, string> = {
  assistant: '#9a7df0',
  document: '#d99b39',
  'history-summary': '#5e9ce6',
  knowledge: '#56b9a5',
  memory: '#c77dd4',
  'message-overhead': '#727b70',
  'runtime-state': '#dd7834',
  skill: '#d45e87',
  system: '#e67a2e',
  'tool-call': '#f0b82f',
  'tool-result': '#8fcf2e',
  'tool-schema': '#37bdb4',
  unattributed: '#778078',
  user: '#3d9a5f',
}

export const isAiCallSource = (value: string): value is AiCallSource =>
  (AI_CALL_SOURCES as readonly string[]).includes(value)

export type AiCallSegment = {
  source: AiCallSource
  tokens: number
  cached: boolean
  injected: boolean
  messageId?: string
}

export type AiCallSnapshot = {
  callIndex: number
  totalTokens: number
  windowTokens?: number
  cacheHitTokens: number
  reprocessedTokens: number
  unchangedTokens: number
  cacheBroke: boolean
  brokeAt?: string
  segments: AiCallSegment[]
  tokenSnapshot?: TurnTokenSnapshot
  usage?: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    reasoning?: number
  }
}

type AiTraceBase = {
  runId: string
  ts: number
}

export type AiTraceRunStartEvent = AiTraceBase & {
  type: 'run_start'
  sessionId: string
  rawName: string
  hash?: string
  provider: string
  model: string
}

export type AiTraceCallCompiledEvent = AiTraceBase & {
  type: 'call_compiled'
  callIndex: number
  snapshot: AiCallSnapshot
}

export type AiTraceCallUsageEvent = AiTraceBase & {
  type: 'call_usage'
  callIndex: number
  snapshot: AiCallSnapshot
}

export type AiTraceCacheBrokeEvent = AiTraceBase & {
  type: 'cache_broke'
  callIndex: number
  processorId?: string
  reason: string
  firstChangedIndex: number
  mutation?: PrefixMutationEvent
}

export type AiTraceToolStartEvent = AiTraceBase & {
  type: 'tool_start'
  callIndex: number
  toolCallId: string
  toolName: string
  argsPreview: string
}

export type AiTraceToolEndEvent = AiTraceBase & {
  type: 'tool_end'
  callIndex: number
  toolCallId: string
  toolName: string
  isError: boolean
  durationMs: number
  resultPreview: string
}

export type AiTraceRetryScheduledEvent = AiTraceBase & {
  type: 'retry_scheduled'
  callIndex: number
  attempt: number
  maxAttempts: number
  delayMs: number
  errorMessage: string
}

export type AiTraceRetryAttemptEvent = AiTraceBase & {
  type: 'retry_attempt'
  callIndex: number
  attempt: number
}

export type AiTraceRateLimitEvent = AiTraceBase & {
  type: 'rate_limit'
  callIndex: number
  retryAfterMs?: number
  remaining?: string
  reset?: string
}

export type AiTraceRunEndEvent = AiTraceBase & {
  type: 'run_end'
  ok: boolean
  durationMs: number
  error?: string
  mediaType?: string
  confidence?: number
}

export type AiTraceEvent =
  | AiTraceRunStartEvent
  | AiTraceCallCompiledEvent
  | AiTraceCallUsageEvent
  | AiTraceCacheBrokeEvent
  | AiTraceToolStartEvent
  | AiTraceToolEndEvent
  | AiTraceRetryScheduledEvent
  | AiTraceRetryAttemptEvent
  | AiTraceRateLimitEvent
  | AiTraceRunEndEvent

export type AiTraceRun = {
  runId: string
  sessionId: string
  rawName: string
  hash?: string
  provider: string
  model: string
  startedAt: number
  endedAt?: number
  ok?: boolean
  events: AiTraceEvent[]
}

export type AiTraceExportTool = {
  name: string
  label: string
  description: string
  parameters: unknown
}

export type AiTraceExportInvocation = {
  callIndex: number
  toolCallId: string
  toolName: string
  args?: unknown
  result?: unknown
  isError?: boolean
  durationMs?: number
}

export type AiTraceExportPrompt = {
  system: string
  compiledSystem?: string
  user: string
  fileTree: string | null
  skillCatalog: string
}

export type AiTraceExportCall = {
  callIndex: number
  systemPrompt: string
}

export type AiTraceExport = {
  version: 1
  exportedAt: string
  run: AiTraceRun
  prompt: AiTraceExportPrompt
  tools: AiTraceExportTool[]
  invocations: AiTraceExportInvocation[]
  compiledByCall: AiTraceExportCall[]
  messages: unknown[]
}
