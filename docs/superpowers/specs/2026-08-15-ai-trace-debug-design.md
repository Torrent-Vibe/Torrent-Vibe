# AI analysis trace debug

Date: 2026-08-15

## Goal

Make each torrent-ai `analyzeName` run inspectable. Electron logs should
show a readable per-call timeline. When the settings switch is on, a
floating inspector renders the same events as a context-window composition
chart (one stacked bar per LLM call), with tool calls and retry scheduling
nested between calls.

## Decisions

1. One normalized `AiTraceEvent` bus. electron-log and the renderer panel
   consume the same events.
2. The panel hero is a per-call composition bar, not a log list. Encoding
   matches the message-engine context-window chart: role color, cache vs
   re-process fill, message-boundary ticks, injected-block markers,
   annotation line under each bar.
3. Settings switch `ai.debugTrace` (default off). Works in production
   builds. Panel mounts and main broadcasts only when it is on.
4. Detailed electron-log timeline: always in development; in production
   only when `debugTrace` is on.
5. Enable message-engine `tokenAccounting` on the analysis engine so bars
   have real segment tokens. Estimated tokenizer (`ceil(chars / 4)`) is
   enough for proportions; Pi `Usage` is applied via `recordUsage` when
   the assistant turn ends.
6. Always pass `maxRetries: 2` and `maxRetryDelayMs: 15_000` on the
   analysis stream. Emit `retry_scheduled` / `retry_attempt` from
   observed 429 + `Retry-After` on `onResponse`. Do not add a second
   retry loop around `streamSimple`.
7. In-memory only. Last 20 runs. No disk persistence of traces.
8. Electron only. Web has no main-process agent and no panel.

## Out of scope

- message-engine sunburst / standalone HTML export
- Per-torrent-row debug entry
- Persisting traces across app restarts
- Changing analysis prompts, tools, cache keys, or `analyzeName` IPC
- Accurate model-specific tokenizers (tiktoken / o200k)
- Cost / pricing UI

## Runtime shape

```
analyzeName
    ↓  runId + sessionId
runAnalysisAgent
    ├─ tokenAccounting + onCompiled / onPrefixMutation
    ├─ agent.subscribe          → tool / turn lifecycle
    └─ streamFn wrap
         ├─ onResponse          → retry-after / rate-limit headers
         └─ retry policy        → retry scheduled / attempt
    ↓
AiTraceSink
    ├─ electron-log timeline    (dev always; prod if debugTrace)
    └─ BridgeService            (only if debugTrace)
         ↓
renderer torrent-ai-trace store
         ↓
floating inspector
```

## Event schema

Shared types live in `packages/shared/src/torrent-ai-trace.ts`.

`runId` is a short id (8 hex chars from the session UUID). Every event
carries `runId` and `ts`.

```ts
type AiTraceEvent =
  | {
      type: 'run_start'
      runId: string
      ts: number
      sessionId: string
      rawName: string
      hash?: string
      provider: string
      model: string
    }
  | {
      type: 'call_compiled'
      runId: string
      ts: number
      callIndex: number
      snapshot: AiCallSnapshot
    }
  | {
      type: 'call_usage'
      runId: string
      ts: number
      callIndex: number
      snapshot: AiCallSnapshot
    }
  | {
      type: 'cache_broke'
      runId: string
      ts: number
      callIndex: number
      processorId?: string
      reason: string
      firstChangedIndex: number
    }
  | {
      type: 'tool_start'
      runId: string
      ts: number
      callIndex: number
      toolCallId: string
      toolName: string
      argsPreview: string
    }
  | {
      type: 'tool_end'
      runId: string
      ts: number
      callIndex: number
      toolCallId: string
      toolName: string
      isError: boolean
      durationMs: number
      resultPreview: string
    }
  | {
      type: 'retry_scheduled'
      runId: string
      ts: number
      callIndex: number
      attempt: number
      maxAttempts: number
      delayMs: number
      errorMessage: string
    }
  | {
      type: 'retry_attempt'
      runId: string
      ts: number
      callIndex: number
      attempt: number
    }
  | {
      type: 'rate_limit'
      runId: string
      ts: number
      callIndex: number
      retryAfterMs?: number
      remaining?: string
      reset?: string
    }
  | {
      type: 'run_end'
      runId: string
      ts: number
      ok: boolean
      durationMs: number
      error?: string
      mediaType?: string
      confidence?: number
    }
```

`AiTraceRun` is the snapshot IPC unit:

```ts
type AiTraceRun = {
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
```

Ring buffer keeps the last 20 runs. Each run keeps events in order.
Cap at 400 events per run; drop the oldest non-bookend events first.

`AiCallSnapshot` is a renderer-safe projection of
`TurnTokenSnapshot`. It must not include raw segment text.

```ts
type AiCallSegment = {
  source: 'system' | 'user' | 'assistant' | 'tool'
  assistantKind?: 'reasoning' | 'content' | 'tool-use'
  tokens: number
  cached: boolean
  injected: boolean
  messageId?: string
}

type AiCallSnapshot = {
  callIndex: number
  totalTokens: number
  windowTokens?: number
  cacheHitTokens: number
  reprocessedTokens: number
  unchangedTokens: number
  cacheBroke: boolean
  brokeAt?: string
  segments: AiCallSegment[]
  usage?: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    reasoning?: number
  }
}
```

Source mapping from message-engine `TokenSourceType`:

| engine source | bar source | assistantKind |
|---|---|---|
| `system` / `skill` / `tool-schema` | `system` | |
| `user` / `document` / `runtime-state` | `user` | |
| `assistant` | `assistant` | `content` |
| `tool-call` | `assistant` | `tool-use` |
| `tool-result` | `tool` | |
| everything else | nearest role by `framingType`, else `system` | |

`injected` is true when `cacheScope === 'turn'` or `processorId` is
`torrent-ai.skill-catalog` / `torrent-ai.file-tree`.

`cached` is true when `cacheStatus` is `reused-internally` or
`provider-cache-read`. After `recordUsage`, provider cache-read wins.

Message-boundary ticks are derived at render time: a tick before every
segment whose `messageId` (kept on the projected segment as optional
`messageId?: string`) differs from the previous segment. Do not invent
boundaries when `messageId` is missing.

Previews (`argsPreview`, `resultPreview`, `errorMessage`) are truncated
to 2048 characters. Authorization and cookie headers from `onResponse`
are dropped.

## Collecting events

### Token accounting

`createPiMessageEngine` gains:

```ts
tokenAccounting: {
  tokenizer: {
    id: 'estimate/chars-div-4',
    accuracy: 'estimated',
    count: (content) => Math.ceil(content.length / 4),
  },
  retainTurns: 50,
},
hooks: {
  onPrefixMutation(event) { /* emit cache_broke */ },
},
```

`createTransformContext` must pass:

- `runtime: { provider: runtime.id, model: runtime.modelId }`
- `turnId: () => currentTurnId` where `currentTurnId` is
  `${sessionId}:${callIndex}` and `callIndex` increments in `step()`

On `onCompiled`:

1. `systemPromptBridge.capture(result)` stays.
2. Remember `lastTurnId = result.tokenSnapshot?.turnId ?? currentTurnId`.
3. If `result.tokenSnapshot` exists, emit `call_compiled` with the
   projected snapshot. `callIndex` is the current turn counter.

After an assistant `message_end` with `usage`, call
`engine.recordUsage(lastTurnId, { inputTokens: usage.input, outputTokens:
usage.output, cacheReadTokens: usage.cacheRead, cacheWriteTokens:
usage.cacheWrite, reasoningTokens: usage.reasoning })` and emit
`call_usage` with the updated snapshot. If the engine has no matching
turn, skip silently.

### Agent subscribe

Map only:

- `tool_execution_start` → `tool_start`
- `tool_execution_end` → `tool_end`
- ignore `message_update` text deltas (too noisy for both log and panel)

`callIndex` is the in-flight turn at subscribe time.

### Stream wrap

Wrap `streamSimple`:

- Always set `maxRetries: 2` and `maxRetryDelayMs: 15_000` on the
  stream options. This is product behavior, not gated by `debugTrace`.
- `onResponse`: parse `retry-after`, `x-ratelimit-remaining`,
  `x-ratelimit-reset` (and `retry-after-ms` if present). Emit
  `rate_limit` when at least one of those is present.
- If the response status is 429, also emit `retry_scheduled` with
  `delayMs` from `Retry-After` (seconds or HTTP-date) capped by
  `maxRetryDelayMs`. Emit `retry_attempt` when the next `onResponse`
  for the same call arrives.
- Do not wrap `streamSimple` in `retryAssistantCall`. Provider-side
  `maxRetries` is the only retry mechanism.

### Run bookends

`engine.ts` emits `run_start` before `runAnalysisAgent` and `run_end`
after parse / catch, including duration and a short result summary.

## Logging

Scope: `[torrent-ai.trace]`.

```
[torrent-ai.trace] ▶ run 7f3a2c  The.Matrix.1999.1080p  provider=codex model=…
[torrent-ai.trace]   call 1  11.3k  cold start
[torrent-ai.trace]   tool ▶ tmdbSearch  {"query":"The Matrix","year":1999}
[torrent-ai.trace]   tool ■ tmdbSearch  182ms  ok
[torrent-ai.trace]   retry scheduled  1/2  wait 800ms  429
[torrent-ai.trace]   call 2  17.4k  cache broke at skill-catalog  reprocess 17.4k
[torrent-ai.trace] ■ run 7f3a2c  ok  4.1s  movie  confidence=0.92
```

Do not dump full prompts or full tool JSON. Previews only.

## Settings and IPC

`AppSettingsStore`:

```ts
ai?: {
  preferredProviders?: AiProviderId[]
  searchProvider?: SearchProviderId
  debugTrace?: boolean
}
```

`getAiDebugTrace()` / `setAiDebugTrace(value: boolean)`. Default false.

`appSettings.getAiSettings` also returns `debugTrace`.
`appSettings.setAiDebugTrace({ debugTrace: boolean })` persists and
tells the sink to start or stop broadcasting.

`torrentAi.getTraceSnapshot()` returns `{ runs: AiTraceRun[] }` from the
main ring buffer so a panel that opens mid-session is not empty.

`BridgeEventMap` adds:

```ts
'torrent-ai:trace': AiTraceEvent
```

Broadcast only when `debugTrace` is on. Turning the switch off does not
clear the ring buffer; the renderer drops its store and unmounts.

Settings export includes `aiDebugTrace` on `desktopAppSettings`.

Renderer switch lives on `ApiTokensTab` in the AI section.

## Panel

Module: `layer/renderer/src/modules/torrent-ai-trace/` following
store-actions (`store.ts`, `actions/`, selectors). Mount from
`RootProviders` when Electron and `debugTrace` is on.

Chrome:

- Collapsed: bottom-right pill `AI Trace · N running`.
- Expanded: `min(920px, 72vw)` × `min(560px, 70vh)`,
  `bg-material-medium backdrop-blur border-border`. Follows app light /
  dark. Not the reference cream paper.
- Header: title, run select (rawName + provider/model), collapse, close
  (close = collapse; the setting stays on).
- Body: composition chart for the selected run.
- Footer: color legend + one-line cache-break summary.

Chart:

- One row per `call_compiled` / `call_usage` (usage replaces the row).
- Left gutter: `Call N` + token count + `% of window`. Window is the
  largest `totalTokens` in the run (same scaling as the reference).
- Track: stacked segments. Colors — system orange, user green, assistant
  blue, tool gray. Assistant sub-kinds share hue, change luminance.
  Cached = solid lighter fill. Re-processed = diagonal hatch. Message
  boundaries = 1px ticks. Injected = small `i` marker on the segment.
- Annotation under the bar: cache hit / cache broke / retry scheduled.
- Tool and retry events belonging to that call render as indented rows
  between this bar and the next. Click expands the truncated preview.

Empty state: "No analysis yet". Running run with no compiled call yet:
skeleton track.

`prefers-reduced-motion`: no hatch animation, no bar grow.

## Error handling

- Tokenizer / `recordUsage` / snapshot projection failures are swallowed
  by the sink. Analysis still completes. Log a single warn per run.
- Missing `tokenSnapshot` still emits tool / retry / run events. The
  chart shows a placeholder bar labeled `tokens unknown` for that call.
- Bridge send failures are ignored.
- Renderer ignores events for unknown types (forward compatible).
- Turning `debugTrace` on mid-run: subsequent events stream; snapshot
  IPC backfills whatever the ring already has.

## Files

Main:

- `layer/main/src/services/torrent-ai/trace.ts` (new) — sink, ring,
  pretty log, projection
- `layer/main/src/services/torrent-ai/session.ts` — accounting, hooks,
  subscribe, stream wrap
- `layer/main/src/services/torrent-ai/engine.ts` — run_start / run_end
- `layer/main/src/services/app-settings-store.ts`
- `layer/main/src/ipc/app-settings.service.ts`
- `layer/main/src/ipc/torrent-ai.service.ts` — `getTraceSnapshot`
- `layer/main/src/@types/bridge-events.ts`

Shared:

- `packages/shared/src/torrent-ai-trace.ts`
- `packages/shared/src/index.ts`

Renderer:

- `layer/renderer/src/modules/torrent-ai-trace/*`
- `layer/renderer/src/providers/RootProviders.tsx`
- `layer/renderer/src/modules/modals/SettingsModal/tabs/ApiTokensTab.tsx`
- `layer/renderer/src/modules/settings-data-management/app-settings-data.ts`
- `locales/setting/en.json`, `locales/setting/zh-CN.json`

Do not add a new npm dependency for tokenization.

## Acceptance

- `pnpm -F @torrent-vibe/main typecheck` and renderer typecheck on
  touched packages pass
- With `debugTrace` off in a production-like log level, main does not
  broadcast `torrent-ai:trace` and the panel is not mounted
- With `debugTrace` on, a forced analyze produces at least `run_start`,
  one `call_compiled` (when the engine compiled), tool events if tools
  ran, and `run_end`
- Panel bars scale to the largest call in that run
- Tool args / results in log and panel are truncated
- Authorization headers never appear in events
- Cache-broke annotation appears when `onPrefixMutation` fires
- Settings export / import round-trips `aiDebugTrace`

## Follow-ups

- Swap the estimated tokenizer for a model-native one
- Optional HTML export of a run
- Per-torrent jump from `TorrentAiMetadataRow` into the selected run
