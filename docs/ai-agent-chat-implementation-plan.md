# AI Agent and Chat Implementation Plan

Status: In progress - first vertical slice implemented  
Specification: [AI Agent and Chat Specification](./ai-agent-chat-spec.md)

## Current implementation status

Completed in the first vertical slice:

- shared Agent chat, context, activity, and operation-plan contracts;
- shared AI provider configuration without changing metadata enrichment behavior;
- one `pi-agent-core` ChatAgent with bounded queue query, inspection, and
  cache-aware media metadata tools;
- paged organization previews for completed qBittorrent downloads, including
  bounded file-tree context and cache-aware media recognition;
- pause / resume / category / tag / per-torrent limit / recheck / reannounce /
  qBittorrent add-from-link / rename / save-location / removal plan preparation,
  explicit renderer confirmation, live-state revalidation, idempotent execution,
  and per-target outcomes; file deletion requires a second final confirmation;
- independent floating Agent panel, contextual empty state, Streamdown / AI
  Elements transcript, live cancellation, run metadata, and plan cards;
- torrent context-menu `Ask Agent`, removable draft scope chips, immutable
  per-message context display, and run-scoped qBittorrent session binding;
- bounded main-process conversation persistence with latest-chat recovery and a
  temporary History overlay for restoring or deleting conversations;
- a DEV-only local message fixture that exercises the real stream reconciliation
  and AI Elements renderer without sending a model request;
- typed run, text, reasoning, activity, plan, and completion streaming events
  with ordered renderer reconciliation;
- focused domain tests for zero-side-effect planning, idempotent execution,
  drift rejection, partial failures, and bounded query behavior.

Still pending: confirmed execution of reviewed organization suggestions and the
scoped Phase 7 Electron acceptance matrix.

## 1. Delivery objective

Deliver an Electron-first Torrent and Media Operations Agent using the existing
`pi-agent-core` stack. V1 must support multi-turn chat, scoped torrent queries,
metadata resolution, previewable torrent mutations, explicit approval,
auditable execution, and dry-run organization of completed qBittorrent content.

This plan is sequential by dependency. A phase is complete only when its
verification gate passes; creating the files or rendering a static surface is
not sufficient.

## 2. Delivery rules

- Preserve current `torrent-ai` metadata behavior while extracting shared
  runtime pieces.
- Do not expose shell, arbitrary qBittorrent methods, credentials, or raw paths
  to the model.
- Keep React state serializable and business logic in singleton actions and
  deterministic main-process services.
- Add behavior-oriented tests. Do not snapshot internal tool arrays or static
  risk tables without an observable contract.
- Every mutation path must first work through deterministic APIs without the
  model before it is registered as an agent tool.
- Keep each phase vertically runnable where possible.
- Gate unfinished user-facing behavior behind an explicit application feature
  flag, not a build-time Trial/Pro variant.

## 3. Phase overview

| Phase | Outcome                                                               |
| ----- | --------------------------------------------------------------------- |
| 0     | Contract and baseline locked                                          |
| 1     | Shared `pi-agent-core` runtime extracted without metadata regressions |
| 2     | Persistent multi-turn ChatAgent and typed streaming IPC               |
| 3     | Read-only torrent tools and immutable UI context snapshots            |
| 4     | Floating panel, scoped context, transcript, composer, and history UI  |
| 5     | Operation planning, approval, and safe torrent execution              |
| 6     | Completed-download inspection and preview-only organization           |
| 7     | Security, resilience, performance, and end-to-end acceptance          |

## 4. Phase 0 - Contract and baseline

### Scope

1. Confirm the seven tool names and their V1 schemas from the specification.
2. Define symbolic error codes, risk levels, plan statuses, and streaming event
   kinds in `packages/shared`.
3. Record current metadata enrichment behavior and trace output with focused
   tests before moving shared runtime code.
4. Confirm the feature flag and persistence location for Agent Chat.
5. Decide the exact app shortcut after auditing existing hotkeys.

### Expected files

- `packages/shared/src/agent-chat.ts`
- `packages/shared/src/agent-tools.ts`
- `packages/shared/src/operation-plan.ts`
- `packages/shared/src/index.ts`
- focused existing `torrent-ai` tests or new contract tests under
  `layer/main/src/services/torrent-ai`

### Verification gate

- Shared types compile in main and renderer.
- Existing metadata analysis tests remain green.
- Tool schemas reject arbitrary qBittorrent method names, raw credentials, and
  raw ungranted library paths.

## 5. Phase 1 - Shared AI runtime extraction

### Scope

Extract framework-level behavior from `torrent-ai` into `ai-runtime`:

- provider selection and model resolution;
- `pi-agent-core` session creation;
- message-engine bridge setup;
- retry and rate-limit hooks;
- common trace projection and redaction;
- abort handling;
- shared tool activity events.

Keep metadata-only prompts, schemas, TMDB tools, and submit behavior inside
`torrent-ai`.

### Expected files

- new `layer/main/src/services/ai-runtime/`
- updates to `layer/main/src/services/torrent-ai/engine.ts`
- updates to `layer/main/src/services/torrent-ai/session.ts`
- focused runtime and metadata regression tests

### Important constraints

- Do not turn the metadata system prompt into the ChatAgent prompt.
- Do not expose the existing Bash tool through the shared runtime by default.
- Tools are provided explicitly per workflow.
- Preserve provider fallback, Codex credential handling, retry behavior, cache
  behavior, and existing trace semantics.

### Verification gate

- Existing metadata enrichment produces the same normalized result shape.
- Provider selection and missing-credential errors remain compatible.
- Trace exports still redact secrets.
- Cancellation can abort a test agent run without leaving its run active.
- `pnpm typecheck:main` and focused main-process tests pass.

## 6. Phase 2 - Multi-turn ChatAgent and transport

### Scope

Implement the main-process conversation engine and persistence:

- create, list, read, rename, and delete conversations;
- send a user message with an immutable context snapshot;
- stream assistant deltas and tool activities;
- stop an active run;
- persist projected messages, plans, and results;
- reconnect the renderer to an in-flight or completed run;
- bound history and trace retention.

Use `pi-agent-core` for ChatAgent execution and the shared AI runtime from Phase

1. ChatAgent gets its own system prompt and does not require a terminal submit
   tool for ordinary assistant responses.

### Expected files

- `layer/main/src/services/agent-chat/engine.ts`
- `layer/main/src/services/agent-chat/session.ts`
- `layer/main/src/services/agent-chat/prompt.ts`
- `layer/main/src/services/agent-chat/database.ts`
- `layer/main/src/services/agent-chat/events.ts`
- `layer/main/src/ipc/agent-chat.service.ts`
- `layer/main/src/ipc/services.ts`
- `layer/main/src/@types/bridge-events.ts`
- generated/derived renderer IPC types as required by the existing bridge

### IPC surface

Request/response methods should cover:

- `createConversation`
- `listConversations`
- `getConversation`
- `deleteConversation`
- `sendMessage`
- `stopRun`

Streaming uses one typed bridge event family with conversation ID, run ID,
monotonic sequence, and projected payload.

### Verification gate

- A conversation survives app-service reinitialization in a test database.
- Duplicate or out-of-order stream events reconcile deterministically.
- Stop preserves partial assistant output and records a cancelled run.
- Panel subscribers can reconnect using conversation/run IDs.
- Conversation deletion does not delete immutable audit rows for executed
  operations.

## 7. Phase 3 - Read-only torrent tools and context

### Scope

Create deterministic query services before registering tools:

1. Project active-server torrent data into bounded query records.
2. Support explicit filtering, sorting, aggregation, and pagination.
3. Inspect exact hashes for files, properties, trackers, peers, and cached AI
   metadata.
4. Adapt the current `torrent-ai` workflow as `resolve_media_metadata`.
5. Inject an immutable renderer-provided context snapshot into each sent
   message.
6. Register only these tools:
   - `query_torrents`
   - `inspect_torrents`
   - `resolve_media_metadata`

### Expected files

- `layer/main/src/services/torrent-operations/query.ts`
- `layer/main/src/services/torrent-operations/inspect.ts`
- `layer/main/src/services/agent-chat/tools/query-torrents.ts`
- `layer/main/src/services/agent-chat/tools/inspect-torrents.ts`
- `layer/main/src/services/agent-chat/tools/resolve-media-metadata.ts`
- renderer context adapter under `layer/renderer/src/modules/agent-chat/`

### Query rules

- Use active server by default.
- Cross-server scope must be explicit.
- Hashes are exact targets; names are presentation only.
- Results are bounded and summarize large file/peer lists.
- Torrent names, tracker messages, and filenames are untrusted data.
- qBittorrent credentials remain inside the main-process session pool.

### Verification gate

- The agent correctly summarizes a fixture queue.
- Exact selected hashes remain stable after live selection changes.
- Switching active servers during a run does not redirect tool calls.
- Tool results never include credentials, cookies, helper tokens, or arbitrary
  internal qBittorrent client objects.
- Query and inspect failures return stable error codes and retryability.

## 8. Phase 4 - Floating panel and conversation UI

### Scope

Build an Agent surface independent of the torrent Details panel:

- independent visibility, width, and height state;
- shared floating shell, independent width / height, resize, and close behavior;
- global header entry;
- selection/context-menu Ask Agent entry;
- context chips and immutable sent-message context display;
- Streamdown and AI Elements transcript renderer;
- compact tool activity rows;
- assistant model, token, cost, TTFT, duration, and TPS metadata;
- composer with Send/Stop and draft preservation;
- empty, loading, provider-missing, error, and cancelled states;
- New Chat and History overlay.

### Expected files

- updates to `layer/renderer/src/modules/layout/desktop/components/Layout.tsx`
- `layer/renderer/src/modules/agent-chat/store.ts`
- `layer/renderer/src/modules/agent-chat/actions/`
- `layer/renderer/src/modules/agent-chat/selectors.ts`
- `layer/renderer/src/modules/agent-chat/components/`
- header and torrent-context-menu integration
- `locales/app/en.json`
- `locales/app/zh-CN.json`

### UI state requirements

- Closing the panel does not cancel a run or lose a draft.
- Tool activity is collapsed by default and accessible when expanded.
- Normal assistant text is not wrapped in a generic card.
- Plans, warnings, and results have dedicated semantic surfaces.
- The Agent accent remains consistent with the existing app palette.
- Keyboard focus moves predictably when opening, sending, stopping, approving,
  and closing.

### Verification gate

- Renderer behavior tests cover store reconciliation, request tokens, draft
  preservation, context snapshots, Stop, and reconnect.
- Desktop manual QA covers floating, resized, closed, narrow-window, and provider-missing
  states, plus coexistence with floating Details.
- Agent and Details retain independent visibility, width, and active content.
- Existing torrent detail interactions still work.
- English and Chinese locale validation passes.

## 9. Phase 5 - Operation plans and torrent execution

### Scope

Build deterministic mutation preparation and execution before exposing it to
the agent:

- explicit operation discriminated unions;
- exact target resolution;
- before/after projection;
- risk classification;
- plan persistence and digest;
- expiration and freshness checks;
- one-time approval tokens;
- idempotent operation execution;
- per-target changed/skipped/failed results;
- audit events;
- renderer plan and result blocks.

Register:

- `prepare_torrent_operation`
- `execute_approved_plan`

Extend the Agent Chat IPC surface with:

- `approvePlan`
- `rejectPlan`

### Expected files

- `layer/main/src/services/operation-plans/`
- `layer/main/src/services/torrent-operations/commands.ts`
- `layer/main/src/services/agent-chat/tools/prepare-torrent-operation.ts`
- `layer/main/src/services/agent-chat/tools/execute-approved-plan.ts`
- renderer plan, approval, destructive-confirmation, and result components

### Supported V1 operations

- pause and resume;
- add user-provided magnet and HTTP(S) torrent URLs;
- set category;
- add/remove tags;
- set download/upload/share limits;
- recheck and reannounce;
- torrent rename;
- qBittorrent-managed location change;
- torrent removal, with file deletion as a distinct destructive choice.

### Important constraints

- Tool preparation performs no mutation.
- Approval is created by a renderer user action and validated in main.
- The model cannot synthesize an approval token.
- The executor accepts plan ID and token only, not new operation arguments.
- Re-read target state before execution.
- Stale plans require a new preview.
- Never reuse renderer toast-oriented `TorrentActions` as the agent contract.

### Verification gate

- Every operation works through the deterministic command service without an
  agent.
- Preparing a plan makes no qBittorrent mutation.
- A forged, expired, consumed, or wrong-plan approval token is rejected.
- Stale target state blocks execution.
- Retrying a completed operation does not apply it twice.
- Partial failures are projected accurately.
- File deletion always requires the second destructive confirmation.

## 10. Phase 6 - Completed-download organization preview

### Scope

Reuse qBittorrent's completed-download index and existing metadata workflow:

- page completed torrents from the captured server;
- read each torrent's bounded file tree through qBittorrent;
- reuse cached media recognition with file-tree context;
- show current name, category, and save path beside organization suggestions;
- keep the first pass preview-only;
- route accepted rename, category, and location changes through existing
  qBittorrent operation plans.

Register:

- `preview_download_organization`

### Expected files

- `layer/main/src/services/agent-chat/torrent-operations.ts`
- `layer/main/src/services/agent-chat/tools.ts`
- existing Agent transcript and torrent operation plan UI

### V1 restrictions

- Only torrents still managed by the captured qBittorrent server are in scope.
- Only completed torrents are included in organization previews.
- File trees are bounded and used as metadata context; raw file contents are
  never read.
- The preview cannot mutate qBittorrent or the filesystem.
- Absolute destination roots are never invented by the model.
- Accepted changes continue through existing qBittorrent operation plans.

### Verification gate

- Completed-only filtering and pagination are deterministic.
- Metadata analysis receives a bounded qBittorrent file tree.
- Preview output includes current name, category, save path, recognition
  confidence, and ambiguity.
- The first preview creates no qBittorrent mutation.
- Any accepted change is represented by the existing reviewable operation plan.

## 11. Phase 7 - Hardening and acceptance

### Security audit

- Confirm ChatAgent receives no Bash tool.
- Confirm no dynamic qBittorrent `method + args` schema is model-visible.
- Fuzz tool schemas with prompt-injection-like torrent names and filenames.
- Audit all trace, log, IPC, database, and renderer projections for secrets.
- Verify library-root containment across platform path variants and symlinks.
- Verify plan approval and idempotency under concurrent clicks and reconnects.

### Performance audit

- Measure large-queue query projection and pagination.
- Measure transcript rendering with long conversations and many activity rows.
- Verify streaming updates do not rerender the torrent table.
- Measure scan memory on a large synthetic library.
- Bound prompt payloads, tool results, trace events, and persisted raw data.

### End-to-end acceptance

Run the acceptance scenarios from the specification with:

- one active server;
- multiple configured servers;
- selected and filtered torrents;
- provider unavailable and provider failure;
- server disconnect during a run;
- stale and expired plans;
- destructive cancellation;
- local media root with conflicts and ambiguous matches;
- app restart and conversation recovery.

### Repository checks

Use the repository-configured commands:

```bash
pnpm -F @torrent-vibe/main test
pnpm -F @torrent-vibe/renderer test
pnpm typecheck:turbo
pnpm lint
pnpm dev:electron
```

For packaged Apple-platform acceptance, use the project's configured valid code
signing. Do not bypass signing to obtain an artifact.

### Completion gate

- All focused tests and repository type checks pass.
- No known security-boundary failure remains.
- The signed Electron app completes the read, mutation, stale-plan,
  destructive-cancel, download-organization preview, Stop, reconnect, and
  restart flows.
- Acceptance evidence identifies the server/fixture, inputs, expected outcome,
  actual result, and captured screenshots or trace exports.

## 12. Suggested commit boundaries

Keep reviewable vertical changes:

1. `refactor: extract shared ai runtime`
2. `feat: add persistent agent chat service`
3. `feat: add read-only torrent agent tools`
4. `feat: add agent workspace dock`
5. `feat: add approved torrent operation plans`
6. `feat: add completed-download organization preview`
7. `test: add agent chat acceptance coverage`

Do not combine organization execution, destructive execution, and
workspace-dock refactors into one change.

## 13. Source change map

Expected existing seams:

- `layer/main/src/services/torrent-ai/` - metadata workflow and shared runtime
  extraction source;
- `layer/main/src/ipc/qbittorrent.service.ts` - internal qBittorrent access,
  never a model-visible generic tool;
- `layer/main/src/@types/bridge-events.ts` - typed streaming events;
- `layer/main/src/ipc/services.ts` - Chat IPC registration;
- `layer/renderer/src/modules/detail/` - current dock/floating behavior;
- `layer/renderer/src/modules/layout/desktop/` - workspace dock composition;
- `layer/renderer/src/modules/torrent/` - selection/context-menu entry points;
- `layer/renderer/src/modules/torrent-ai/` - metadata result reuse;
- `layer/renderer/src/modules/helper-client/` - future remote capabilities;
- `packages/shared/` - cross-process contracts;
- `locales/app/` - user-facing Agent UI strings.

## 14. Out of scope

The Agent roadmap is intentionally limited to organizing torrents and files
still represented by the qBittorrent download library. Arbitrary local-folder
scanning, download history, automation rules, content discovery, Web support,
and native iOS Agent UI are not planned.
