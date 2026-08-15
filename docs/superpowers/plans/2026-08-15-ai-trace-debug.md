# AI Trace Debug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (this session chose inline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each torrent-ai `analyzeName` run inspectable via pretty Electron logs and a settings-gated floating composition chart.

**Architecture:** Normalize Agent / message-engine / HTTP events into `AiTraceEvent`. A main-process sink pretty-logs them and, when `ai.debugTrace` is on, broadcasts to a renderer store that draws one stacked bar per LLM call.

**Tech Stack:** `@earendil-works/pi-agent-core`, `@innei/message-engine` token accounting, existing `electron-log` / `BridgeService` / Zustand store-actions, Tailwind v4.

## Global Constraints

- Electron only. No panel or broadcast on web.
- No new npm dependency for tokenization. Tokenizer is `ceil(chars / 4)`.
- Do not change analysis prompts, tools, cache keys, or `analyzeName` IPC.
- Do not persist traces to disk. Ring buffer = last 20 runs, 400 events each.
- Previews truncated to 2048 chars. Drop `authorization` and `cookie` headers.
- Retry is `maxRetries: 2` + `maxRetryDelayMs: 15_000` on `streamSimple` only. No second retry loop.
- Detailed electron-log: always in development; production only if `debugTrace`.
- Broadcast + panel mount only if `debugTrace`.
- Zero comments / JSDoc in business code.
- Do not commit unless the user asks.
- Typecheck / lint only the files you touch.

---

### Task 1: Shared trace types

**Files:**
- Create: `packages/shared/src/torrent-ai-trace.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `AiTraceEvent`, `AiCallSnapshot`, `AiCallSegment`, `AiTraceRun`, `AI_TRACE_PREVIEW_LIMIT`, `truncateAiTracePreview`

- [ ] **Step 1: Add shared types**

```ts
export const AI_TRACE_PREVIEW_LIMIT = 2048
export const AI_TRACE_RUN_LIMIT = 20
export const AI_TRACE_EVENTS_PER_RUN = 400

export const truncateAiTracePreview = (value: unknown): string => {
  const text
    = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value)
  if (text.length <= AI_TRACE_PREVIEW_LIMIT) {
    return text
  }
  return `${text.slice(0, AI_TRACE_PREVIEW_LIMIT)}…`
}
```

Export the event union and snapshot types exactly as
`docs/superpowers/specs/2026-08-15-ai-trace-debug-design.md` (including
`messageId?` on `AiCallSegment` and `AiTraceRun`).

- [ ] **Step 2: Re-export**

Add `export * from './torrent-ai-trace'` to `packages/shared/src/index.ts`.

- [ ] **Step 3: Typecheck shared**

Run: `pnpm -F @torrent-vibe/shared typecheck`
Expected: pass

---

### Task 2: Main-process sink

**Files:**
- Create: `layer/main/src/services/torrent-ai/trace.ts`

**Interfaces:**
- Consumes: shared `AiTraceEvent` / `AiTraceRun` / truncate helpers
- Produces:
  - `getAiTraceSink(): AiTraceSink`
  - `AiTraceSink.emit(event: AiTraceEvent): void`
  - `AiTraceSink.setBroadcastEnabled(enabled: boolean): void`
  - `AiTraceSink.getSnapshot(): { runs: AiTraceRun[] }`
  - `projectTurnSnapshot(snapshot, extras): AiCallSnapshot`

- [ ] **Step 1: Implement sink**

`getAiTraceSink` is a singleton.

`emit`:
1. Attach event onto the matching run (create the run from `run_start`).
2. Enforce 20-run / 400-event caps (drop oldest non-`run_start`/`run_end` first).
3. Pretty-log when `NODE_ENV === 'development'` or broadcast is enabled.
4. If broadcast enabled, `BridgeService.shared.broadcast('torrent-ai:trace', event)` inside try/catch.

Logger scope: `[torrent-ai.trace]`. Format:

```
▶ run {runId}  {rawName}  provider={id} model={model}
  call {n}  {tokens}  {annotation}
  tool ▶ {name}  {argsPreview}
  tool ■ {name}  {ms}ms  ok|error
  retry scheduled  {attempt}/{max}  wait {delay}ms  {error}
■ run {runId}  ok|fail  {duration}s
```

`projectTurnSnapshot` maps `TurnTokenSnapshot` segments with the spec table.
Copy `messageId` when present. Never copy segment `content`.

`cached` = `cacheStatus` is `reused-internally` or `provider-cache-read`.
`injected` = `cacheScope === 'turn'` or processorId is
`torrent-ai.skill-catalog` / `torrent-ai.file-tree`.

- [ ] **Step 2: Typecheck main file**

Run scoped tsc / `pnpm exec tsc -p layer/main --pretty false --noEmit` if the
package script is heavy; otherwise `pnpm -F @torrent-vibe/main typecheck`.
Expected: pass once later tasks exist; this file may reference
`BridgeService` and `TurnTokenSnapshot` which already exist.

---

### Task 3: Settings, IPC, bridge event

**Files:**
- Modify: `layer/main/src/services/app-settings-store.ts`
- Modify: `layer/main/src/ipc/app-settings.service.ts`
- Modify: `layer/main/src/ipc/torrent-ai.service.ts`
- Modify: `layer/main/src/@types/bridge-events.ts`
- Modify: `layer/renderer/src/modules/settings-data-management/app-settings-data.ts`

**Interfaces:**
- Produces:
  - `AppSettingsStore.getAiDebugTrace(): boolean`
  - `AppSettingsStore.setAiDebugTrace(value: boolean): boolean`
  - `appSettings.getAiSettings()` includes `debugTrace: boolean`
  - `appSettings.setAiDebugTrace({ debugTrace: boolean })`
  - `torrentAi.getTraceSnapshot(): { runs: AiTraceRun[] }`
  - `BridgeEventMap['torrent-ai:trace']: AiTraceEvent`

- [ ] **Step 1: Persist flag**

```ts
ai?: {
  preferredProviders?: AiProviderId[]
  searchProvider?: SearchProviderId
  debugTrace?: boolean
}

getAiDebugTrace(): boolean {
  return this.cache.ai?.debugTrace === true
}

setAiDebugTrace(value: boolean): boolean {
  this.cache.ai = { ...this.cache.ai, debugTrace: value }
  this.save()
  return this.getAiDebugTrace()
}
```

`setAiDebugTrace` IPC also calls `getAiTraceSink().setBroadcastEnabled(value)`.

On main startup (when settings store is first read is enough if the sink
defaults to `getAiDebugTrace()`), enable broadcast if already true.

- [ ] **Step 2: Export schema**

Add `aiDebugTrace: z.boolean().optional()` to `desktopAppSettingsSchema`.
Round-trip it in the existing desktop settings export/import helpers that
already handle `aiPreferredProviders`.

- [ ] **Step 3: Typecheck touched packages**

---

### Task 4: Instrument the agent session

**Files:**
- Modify: `layer/main/src/services/torrent-ai/session.ts`

**Interfaces:**
- Consumes: `getAiTraceSink()`, `projectTurnSnapshot`
- Extends `runAnalysisAgent` input with
  `{ runId: string, rawName: string, hash?: string }`
  (rawName/hash only needed if session emits run events; prefer engine
  bookends in Task 5 — session emits call/tool/retry/rate_limit only)

- [ ] **Step 1: Token accounting + hooks**

```ts
tokenAccounting: {
  tokenizer: {
    id: 'estimate/chars-div-4',
    accuracy: 'estimated',
    count: (content) => Math.max(0, Math.ceil(content.length / 4)),
  },
  retainTurns: 50,
},
hooks: {
  onPrefixMutation(event) {
    sink.emit({
      type: 'cache_broke',
      runId,
      ts: Date.now(),
      callIndex: turns,
      processorId: event.processorId,
      reason: event.reason,
      firstChangedIndex: event.firstChangedIndex,
    })
  },
},
```

`createTransformContext`:

```ts
{
  runtime: { provider: input.runtime.id, model: input.runtime.modelId },
  turnId: () => `${input.sessionId}:${turns}`,
  step: () => ({ iteration: ++turns }),
  onCompiled: (result) => {
    systemPromptBridge.capture(result)
    lastTurnId = result.tokenSnapshot?.turnId ?? `${input.sessionId}:${turns}`
    if (result.tokenSnapshot) {
      sink.emit({
        type: 'call_compiled',
        runId,
        ts: Date.now(),
        callIndex: turns,
        snapshot: projectTurnSnapshot(result.tokenSnapshot),
      })
    }
  },
}
```

- [ ] **Step 2: Subscribe + stream wrap**

`agent.subscribe`:
- `tool_execution_start` → `tool_start` with `truncateAiTracePreview(args)`
- `tool_execution_end` → `tool_end` with duration from a `Map<toolCallId, startTs>`
- ignore other events

`streamFn`:
- pass `maxRetries: 2`, `maxRetryDelayMs: 15_000`
- wrap `onResponse`:
  - never copy `authorization` / `cookie`
  - emit `rate_limit` if retry-after / remaining / reset present
  - if `status === 429`, emit `retry_scheduled` with delay from Retry-After
    (seconds or HTTP-date), capped at 15_000
  - emit `retry_attempt` on the next `onResponse` for that call
- after assistant `message_end` with usage, `engine.recordUsage(lastTurnId, …)`
  then emit `call_usage`. Swallow recordUsage errors (one warn per run).

---

### Task 5: Engine run bookends

**Files:**
- Modify: `layer/main/src/services/torrent-ai/engine.ts`

- [ ] **Step 1: Emit run_start / run_end**

Before `runAnalysisAgent`:

```ts
const runId = sessionId.replaceAll('-', '').slice(0, 8)
sink.emit({
  type: 'run_start',
  runId,
  ts: Date.now(),
  sessionId,
  rawName: input.rawName,
  hash: /* options.hash if available */,
  provider: runtime.id,
  model: runtime.modelId,
})
```

Pass `runId` into `runAnalysisAgent`. After parse / in catch / finally-equivalent
path, emit `run_end` with `ok`, `durationMs`, `error`, `mediaType`,
`confidence`.

Do not remove existing coarse `[torrent-ai]` logs in this task.

---

### Task 6: Renderer store + settings switch

**Files:**
- Create: `layer/renderer/src/modules/torrent-ai-trace/types.ts`
- Create: `layer/renderer/src/modules/torrent-ai-trace/store.ts`
- Create: `layer/renderer/src/modules/torrent-ai-trace/actions/index.ts`
- Create: `layer/renderer/src/modules/torrent-ai-trace/index.ts`
- Modify: `layer/renderer/src/modules/modals/SettingsModal/tabs/ApiTokensTab.tsx`
- Modify: `locales/setting/en.json`
- Modify: `locales/setting/zh-CN.json`

**Interfaces:**
- Produces:
  - `TorrentAiTraceActions.shared.configure()`
  - `TorrentAiTraceActions.shared.ingest(event: AiTraceEvent)`
  - `TorrentAiTraceActions.shared.setDebugTrace(enabled: boolean)`
  - `TorrentAiTraceActions.shared.selectRun(runId: string | null)`
  - `TorrentAiTraceActions.shared.setExpanded(expanded: boolean)`
  - `useTorrentAiTraceStore`

State:

```ts
{
  debugTrace: boolean
  expanded: boolean
  selectedRunId: string | null
  runs: Record<string, AiTraceRun>
  runOrder: string[]
}
```

- [ ] **Step 1: Store + actions**

Follow `docs/store-actions-pattern.md`. `configure` loads
`getAiSettings().debugTrace` and, if true, `getTraceSnapshot()` then
subscribes via `useBridgeEvent` from a small mounted listener component
(actions cannot hook). Ingest keeps the same 20-run cap.

- [ ] **Step 2: Settings switch**

In the AI `SettingSectionCard` (Electron only), after the provider
selects, add `SettingSwitchField`:

Keys (leaf only, no parent clash):

```
tabs.apiTokens.debugTrace.label
tabs.apiTokens.debugTrace.description
```

en: "AI debug trace" / "Show a live inspector of each analysis call, tool, and retry. Also writes detailed main-process logs."
zh-CN: "AI 调试跟踪" / "打开后显示每次分析的调用、工具和重试检查器，并写入更详细的主进程日志。"

`onCheckedChange` → `setAiDebugTrace` then `TorrentAiTraceActions.shared.setDebugTrace`.

- [ ] **Step 3: Lint locales + typecheck renderer files**

---

### Task 7: Floating inspector

**Files:**
- Create: `layer/renderer/src/modules/torrent-ai-trace/components/TorrentAiTracePanel.tsx`
- Create: `layer/renderer/src/modules/torrent-ai-trace/components/TorrentAiTraceChart.tsx`
- Modify: `layer/renderer/src/providers/RootProviders.tsx`
- Modify: `locales/app/en.json`
- Modify: `locales/app/zh-CN.json`

- [ ] **Step 1: Chart**

`TorrentAiTraceChart` takes one `AiTraceRun`.

- Group events by `callIndex`.
- Window = max `snapshot.totalTokens` in the run.
- Each call: left gutter `Call N`, `{tokens}`, `{pct}% of window`.
- Track width = `tokens / window`. Stack segments left to right.
- Colors (light/dark via CSS variables on the component):
  - system `#e67a2e`
  - user `#3d9a5f`
  - assistant-content `#3b6fd4`
  - assistant-reasoning `#7ea2e8`
  - assistant-tool-use `#9bb6ea`
  - tool `#8b8f96`
- Cached: same hue, ~45% opacity, solid.
- Re-processed: repeating 45deg stripe (`background-image: repeating-linear-gradient`).
- Injected: a 10px `i` absolutely positioned on the segment.
- Boundary: 1px `bg-text` tick when `messageId` changes.
- Annotation: cache hit / cache broke / retry scheduled.
- Between bars: indented `tool` / `retry` rows; click toggles preview.

Empty: `torrent.ai.trace.empty`. Running without calls: a pulse track.

Respect `prefers-reduced-motion` (no pulse / no stripe animation).

- [ ] **Step 2: Panel chrome**

Collapsed pill, bottom-right, `z-50`, only if `debugTrace`:
`torrent.ai.trace.pill` = `AI Trace · {count} running`.

Expanded: `min(920px, 72vw)` × `min(560px, 70vh)`,
`bg-material-medium backdrop-blur border border-border rounded-xl`.
Header: title, native `<select>` of runs (`rawName · provider/model`),
collapse, close (close = `setExpanded(false)` only).

Footer legend + `torrent.ai.trace.cacheSummary`
`{broke}/{total} calls broke prefix cache`.

Mount `<TorrentAiTracePanel />` in `RootProviders` when `ELECTRON`.
Panel self-hides when `debugTrace` is false.

- [ ] **Step 3: Typecheck / lint touched renderer files**

---

### Task 8: Verify

- [ ] **Step 1: Typecheck main + renderer + shared**

`pnpm -F @torrent-vibe/shared typecheck`
`pnpm -F @torrent-vibe/main typecheck`
`pnpm -F @torrent-vibe/renderer exec tsc --noEmit` (or the package script)

- [ ] **Step 2: Lint only touched files**

`pnpm exec eslint` on the modified list.

- [ ] **Step 3: Manual Electron check**

`pnpm dev:electron`. Turn on the switch. Force-refresh one torrent AI
row. Confirm: pill appears, bars render, tool rows expand, main log
shows `[torrent-ai.trace]`. Turn switch off: panel unmounts, no further
bridge events.
