# AI Agent and Chat Specification

Status: In progress - first vertical slice implemented  
Primary platform: Electron desktop  
Agent runtime: `@earendil-works/pi-agent-core`  
Related plan: [AI Agent and Chat Implementation Plan](./ai-agent-chat-implementation-plan.md)

## Current implementation slice

The first Electron slice now provides an independent floating Agent panel,
multi-turn `pi-agent-core` chat, typed live streaming, Streamdown message
rendering, run metadata, visible immutable server, filter, search, and selection
context, bounded queue query and inspection tools, and reviewable pause / resume
plans. It also resolves selected torrent names through the existing cache-aware
metadata workflow and prepares category and tag changes with before/after and
per-target outcomes. Per-torrent download, upload, ratio, and seeding limits,
plus recheck and reannounce commands, use the same plan lifecycle. Torrent-owned
rename and save-location changes run only through qBittorrent and use the same
preview, confirmation, and live-state revalidation boundary. Torrent removal
uses destructive plan styling; deleting downloaded data requires a second final
renderer confirmation enforced by the main process. User-provided magnet and
HTTP(S) torrent URLs can be reviewed with their captured server, save path,
category, and initial paused state before qBittorrent receives them. Torrent `Ask Agent`
captures an explicit draft scope, while main-process tools remain bound to the
qBittorrent session captured for the run. A plan is executed only from the
renderer confirmation action and is revalidated against live qBittorrent state
immediately before the mutation. Projected conversations are persisted in the
main-process SQLite database and can be restored or deleted from the temporary
History overlay. Completed downloads can be paged into a preview-only
organization workflow that reads bounded qBittorrent file trees and reuses the
existing cache-aware media recognition.

Arbitrary local-folder scanning and files no longer represented by qBittorrent
are outside the product scope.

## 1. Purpose

Torrent Vibe will provide one user-visible AI agent that can understand the
current download workspace, answer questions about it, prepare safe torrent
operations, and help plan media-library organization.

The product is not a generic chatbot embedded in a torrent client. It is a
Torrent and Media Operations Agent with explicit context, typed tools,
previewable changes, user approval, and an auditable execution trail.

This specification replaces the runtime and interaction assumptions in the
legacy [TMDb Content Recognition PRP](../PRPs/TMDb-Content-Recognition-Integration.md).
The existing `torrent-ai` implementation remains the source of truth for
metadata enrichment until it is refactored behind the shared AI runtime.

## 2. Fixed decisions

The following decisions are part of the V1 contract:

- Use `pi-agent-core` and the existing provider adapters. Do not introduce a
  second agent framework.
- Expose one user-visible `ChatAgent`. Do not create separate conversational
  Queue, Media, or Automation agents.
- Keep deterministic torrent, filesystem, and approval behavior outside the
  model. The agent orchestrates typed domain tools; it does not implement the
  business rules itself.
- Ship Electron desktop first. Web and native iOS are follow-up surfaces.
- Present Agent UI in an independent floating panel above the torrent workspace.
- Keep the model-visible tool set limited to torrent queue, metadata,
  organization preview, and reviewed qBittorrent operations. UI context
  injection, approval, streaming, cancellation, and trace transport are
  platform mechanisms, not tools.
- Never expose arbitrary shell execution, arbitrary filesystem paths, secrets,
  or dynamic qBittorrent method dispatch to the model.
- Mutations use a prepare -> review -> approve -> execute lifecycle. The model
  cannot approve its own plan.
- The first organization pass is preview-only. Torrent-owned rename and move
  operations may be executed through qBittorrent after approval; arbitrary
  local-library moves and deletion are not part of V1.

## 3. Goals

### 3.1 Queue understanding

Users can ask questions such as:

- Which downloads are stalled and why?
- Which completed items are still uploading heavily?
- What is consuming the most disk space on this server?
- Which selected torrents have tracker errors or missing files?

Answers must be derived from current structured qBittorrent data and show the
scope and evidence used.

### 3.2 Safe queue operations

Users can request batch operations in natural language, including:

- add a user-provided magnet or HTTP(S) torrent URL;
- pause and resume;
- category and tag changes;
- download, upload, ratio, and seeding limits;
- recheck and reannounce;
- torrent rename and qBittorrent-managed location changes;
- torrent removal, with local-file deletion treated as a separate high-risk
  decision.

The agent must resolve the exact targets and present an operation plan before
execution.

### 3.3 Media understanding and organization planning

Users can:

- resolve completed torrents and their qBittorrent file trees to structured
  metadata;
- inspect confidence and alternative matches;
- detect unrecognized items, naming conflicts, duplicates, and likely missing
  episodes;
- preview names, categories, and relative destination folders before preparing
  any qBittorrent change.

V1 does not perform arbitrary local-library moves, copies, or deletes.

### 3.4 Trust and auditability

Every agent run must make it clear:

- which server, filter, selection, and completed-library page were in scope;
- which tools ran and whether they succeeded;
- which operation was proposed;
- who approved it and when;
- which targets changed, were skipped, or failed.

## 4. Non-goals for V1

- A general desktop assistant.
- Multi-agent delegation visible to the user.
- Autonomous permanent behavior created from conversational memory.
- Arbitrary shell commands or unrestricted network access.
- Scanning arbitrary local folders outside qBittorrent.
- Arbitrary local-file rename, move, copy, or deletion.
- NFO, poster, fanart, or media-server refresh writes.
- Managing torrents that have already been removed from qBittorrent. Deleted
  download history requires a separate history subsystem.
- A fourth native iOS tab dedicated to AI.

## 5. User experience

### 5.1 Agent panel

Agent owns its own panel state and content. It reuses the generic floating panel
shell extracted from Torrent Details, but does not share Details tabs, geometry,
visibility, or content state:

```
┌──────────────────────────────────────────────────────────────┐
│ Header                                                 Agent │
├──────────────────────────────────────────────────────────────┤
│ Torrent workspace                                             │
│                          ┌──────────────────────────────┐     │
│                          │ Agent                    ×   │     │
│                          │ Context · Conversation       │     │
│                          │ Plans · Composer             │     │
│                          └──────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

- `Details` retains its existing General, Files, Peers, and Trackers surface.
- Agent contains the conversation, activities, plans, results, and composer.
- Agent and a floating Details panel may coexist, with Agent above Details when
  their bounds overlap.
- Opening Agent does not resize the torrent workspace.
- Preferred Agent width: 440 px.
- Agent minimum width: 360 px. Agent maximum width: 640 px.
- Preferred Agent height: 600 px. Agent minimum height: 360 px.
- The panel stays anchored to the bottom-right and supports the same three-way
  resize interaction as floating Details.
- On mobile-sized renderers, Agent uses a full-screen surface rather than the
  existing torrent-detail bottom sheet.
- Closing Agent must not discard an active conversation, draft, or run.

### 5.2 Entry points

V1 provides two primary entry points:

1. A global Agent button in the desktop header near Search, Discover, and
   Settings.
2. `Ask Agent` in torrent selection actions and the torrent context menu.

The selection entry opens the panel and attaches the selected hashes as draft
context. It may show prompt suggestions, but it must not send a message without
the user.

A metadata-row or Files-tab entry can be added later without changing the
conversation model.

### 5.3 Context bar and snapshots

The composer displays removable context chips, for example:

```
[Home NAS] [3 selected] [Downloading] [Library: Anime]
```

The context bar is a trust boundary, not decoration.

- The draft context follows the current active server, selection, and filter.
- Sending a message captures an immutable context snapshot.
- Later selection or server changes must not change the meaning of an already
  sent message, in-flight tool call, or pending plan.
- A pending plan displays its captured targets even if the app selection
  changes.
- When no explicit selection is present, the agent may query the active server
  and current filter, but it must not assume all configured servers are in
  scope.
- Cross-server queries require an explicit scope in the user request or UI.

The runtime context is injected into the conversation by the message engine.
It is not exposed as a model-callable tool.

### 5.4 Conversation blocks

The transcript supports five user-facing block types:

1. `message` - user or assistant text;
2. `query-result` - compact structured torrent or media results;
3. `tool-activity` - collapsed progress and outcome rows;
4. `operation-plan` - targets, before/after values, warnings, and approval;
5. `operation-result` - changed, skipped, and failed targets.

Assistant text is full-width. User text may use a compact tinted surface.
Normal assistant content and tool activity must not be placed in generic cards.
Cards are reserved for plans, warnings, and operation results.

Tool activity uses user language rather than internal names:

```
Read 38 torrents
Checked 3 trackers
Matched metadata with TMDB
```

Raw arguments, JSON, and trace data remain behind a developer detail view.

### 5.5 Operation plans

An operation plan must show:

- a human-readable summary;
- server and target count;
- exact targets, collapsed after a short preview;
- before -> after changes;
- skips and conflicts;
- risk level;
- whether the plan is executable or preview-only;
- expiration or stale-state warnings;
- Cancel and Approve actions when executable.

Low- and medium-risk operations are approved inline. Removing torrents uses a
destructive inline action. Deleting local files requires a second final
confirmation surface that lists file count, paths, and total size.

The first media organization response is marked preview-only and does not
prepare or execute mutations. Accepted changes use ordinary qBittorrent plans.

### 5.6 Composer

The composer provides:

- multi-line input;
- context chips;
- Send while idle;
- Stop while the agent is generating or running tools;
- an inline provider-configuration link when no provider is available;
- draft preservation on error or panel close;
- context-aware suggestions only in the empty state.

Waiting for approval does not lock the composer. Users may ask follow-up
questions about the plan before approving it.

### 5.7 Conversation history

- Conversations are global to the app, not owned by individual torrents.
- Each message stores its own context snapshot.
- The panel header provides New Chat and History actions.
- History is a popover or temporary overlay, not a permanent nested sidebar.
- Switching active servers does not silently create a new conversation.
- Conversation titles may be generated after the first completed turn, with a
  deterministic fallback derived from the first user message.

### 5.8 Visual and interaction language

- Reuse the existing neutral surfaces and sky-blue accent.
- Do not introduce purple AI gradients, glow treatments, bot avatars, or
  perpetual decorative animation.
- Use separators and whitespace for transcript structure.
- Use compact monospace text for speeds, sizes, hashes, and paths where useful.
- Use existing spring motion for dock transitions, block insertion, and plan
  expansion. Do not animate every message continuously.
- All running states need an accessible text label; color is never the only
  signal.
- Composer, context chips, activities, and plan actions must be keyboard and
  screen-reader accessible.

## 6. System architecture

### 6.1 High-level flow

```
Renderer Agent Panel
  -> AgentChatActions
  -> typed AgentChat IPC service
  -> ChatAgentEngine (pi-agent-core)
       -> message-engine context providers
       -> typed tool registry
       -> operation plan service
       -> existing metadata workflow
       -> trace and conversation persistence
  -> BridgeService streaming events
  -> Renderer store selectors
```

Torrent mutations are performed by deterministic domain services after plan
approval. React components and the model never perform mutations directly.

### 6.2 Proposed service boundaries

```
layer/main/src/services/
  ai-runtime/               provider selection, sessions, shared trace hooks
  torrent-ai/               metadata enrichment workflow
  agent-chat/               conversations, orchestration, tool registry
  operation-plans/          plan lifecycle, approval, execution, audit
  torrent-operations/       structured qBittorrent queries and commands
```

The existing `torrent-ai` provider adapters, message-engine integration, retry
handling, and trace primitives should move behind `ai-runtime` only when they
can be extracted without changing metadata behavior.

### 6.3 Renderer module boundary

The renderer follows the repository Store + Actions pattern:

```
layer/renderer/src/modules/agent-chat/
  store.ts
  selectors.ts
  types.ts
  actions/
  components/
```

- The Zustand store contains serializable conversations, messages, activities,
  plans, draft state, and view state.
- `AgentChatActions.shared` owns IPC calls, streaming-event reconciliation,
  request tokens, cancellation, history, and approval submission.
- UI components subscribe with focused selectors and render errors. Actions do
  not show toasts.
- Selection and filter stores are read through a context adapter; agent state
  does not duplicate the live torrent store.

## 7. Runtime context contract

Each sent user message captures a context snapshot similar to:

```ts
interface AgentContextSnapshot {
  capturedAt: number
  activeServerId: string | null
  activeServerName: string | null
  selectedTorrentHashes: string[]
  filter: {
    status?: string
    category?: string
    tag?: string
    search?: string
  }
  visibleTorrentCount: number
  grantedLibraryRootIds: string[]
  helperCapabilities: string[]
}
```

The model receives display names and opaque identifiers. Credentials, helper
tokens, API keys, passwords, and raw unrestricted paths are excluded.

## 8. V1 tool contract

| Tool                            | Purpose                                                                | Mutation          | Approval |
| ------------------------------- | ---------------------------------------------------------------------- | ----------------- | -------- |
| `query_torrents`                | Filter, sort, aggregate, and summarize torrent records                 | No                | None     |
| `inspect_torrents`              | Read files, properties, trackers, peers, and metadata for exact hashes | No                | None     |
| `resolve_media_metadata`        | Run or read the existing metadata enrichment workflow                  | No                | None     |
| `preview_download_organization` | Page completed torrents, read bounded file trees, and resolve metadata | No                | None     |
| `prepare_torrent_operation`     | Validate targets and create a torrent operation plan                   | Creates plan only | None     |

### 8.1 Tool design rules

- Tools are semantic domain operations, not one wrapper per qBittorrent
  endpoint.
- `prepare_torrent_operation` uses a strict discriminated union for supported
  actions. It does not accept `method` and `args`.
- Torrent targets use hashes plus a captured server identifier.
- Organization targets remain qBittorrent hashes captured for the active
  server; no arbitrary local filesystem targets are accepted.
- Read tools return bounded, projected data. Large file lists are summarized and
  paginated.
- Tool results use stable symbolic error codes and include retryability.
- The model cannot call current renderer `TorrentActions` directly.
- The model cannot call the generic qBittorrent IPC `call(method, args)` entry.
- The model never receives helper Bearer tokens or qBittorrent credentials.

### 8.2 Supported torrent operations

`prepare_torrent_operation` supports these V1 operation variants:

- `pause`
- `resume`
- `setCategory`
- `updateTags`
- `setDownloadLimit`
- `setUploadLimit`
- `setShareLimits`
- `recheck`
- `reannounce`
- `renameTorrent`
- `moveTorrent`
- `removeTorrent`

Each variant has its own explicit schema. `removeTorrent` includes a separate
`deleteFiles` boolean and always receives destructive risk classification.

## 9. Plan, approval, and execution contract

### 9.1 Plan lifecycle

```
prepared -> awaiting_approval -> approved -> executing -> completed
    |              |               |            |
    +-> stale      +-> rejected    +-> expired  +-> partially_failed
```

Plans are immutable after preparation. A changed request creates a new plan.

### 9.2 Required plan fields

```ts
interface AgentOperationPlan {
  id: string
  conversationId: string
  messageId: string
  kind: 'torrent-operation' | 'media-organization'
  serverId?: string
  rootId?: string
  status: string
  risk: 'read' | 'low' | 'medium' | 'high' | 'destructive'
  executable: boolean
  targetIds: string[]
  summary: string
  changes: Array<{
    targetId: string
    before: unknown
    after: unknown
  }>
  warnings: string[]
  capturedRevision: string
  createdAt: number
  expiresAt: number
}
```

`capturedRevision` is derived from the current server/item state used to
prepare the plan.

### 9.3 Approval token

- Approval is initiated by a renderer user action, not by the model.
- The main process issues or validates a one-time approval token bound to plan
  ID, plan digest, risk, user action, and expiration.
- `execute_approved_plan` accepts only the plan ID and approval token.
- The token cannot approve a different or modified plan.
- Approval tokens are consumed once.

### 9.4 Freshness and idempotency

- Before execution, the operation service re-reads affected state.
- Material target changes mark the plan stale and require a new preview.
- Execution uses a unique operation ID and records per-target results.
- Retrying an already completed operation returns its stored result instead of
  applying it again.
- Partial failures do not roll back unrelated successful targets unless the
  underlying operation supports a safe transactional boundary.

## 10. Download-library boundaries

### 10.1 Completed download source

- The captured qBittorrent server remains the source of truth.
- Organization preview includes only torrents with complete content.
- Completed torrents are paged in bounded groups.
- qBittorrent file trees provide relative path, size, and completion progress.
- Raw file contents and arbitrary host directories are never scanned.

### 10.2 Organization previews

Plans may propose:

- normalized show/movie folders;
- season folders;
- video and subtitle renames;
- conflict and duplicate review;
- items that require manual matching.

The first pass is preview-only. Torrent-owned rename, category, or location
changes must be represented as torrent operations and executed through
qBittorrent so the client remains aware of the files.

## 11. Conversation and trace persistence

Persist in the main process:

- conversation metadata;
- ordered user and assistant messages;
- immutable context snapshots;
- projected tool activities;
- operation plans and results;
- run/provider/model identifiers;
- timestamps and cancellation state.

Raw trace exports remain bounded and redact known secrets. UI history uses the
projected conversation model rather than replaying raw provider messages.

Conversation retention and deletion must be user-controllable. Deleting a
conversation does not delete the operation audit records required to explain
already executed changes.

## 12. Streaming and cancellation

- The renderer sends a message through typed IPC request/response.
- Main broadcasts typed streaming events through the existing BridgeService.
- Events include conversation ID, run ID, monotonic sequence, and event kind.
- The renderer reconciles duplicate or late events by run ID and sequence.
- Stop aborts model generation and cancels not-yet-started read tools.
- Stop never interrupts a mutation already accepted by the deterministic
  executor in a way that could leave its result unrecorded.
- Panel close does not cancel the run.

## 13. Security and privacy

- Do not expose the existing Bash tool to ChatAgent.
- Do not rely on prompt instructions or command-pattern regexes as a security
  boundary.
- Do not expose arbitrary qBittorrent IPC dispatch.
- Treat torrent names, tracker messages, local filenames, metadata, web search
  results, and subtitle names as untrusted data, not instructions.
- Provider prompts receive only the minimum projected data required for the
  current task.
- Secrets are resolved inside deterministic services and excluded from prompts,
  tool results, traces, logs, and renderer state.
- High-risk actions require exact target previews and explicit confirmation.
- Organization previews never turn model-generated relative folders into an
  absolute path; qBittorrent moves require a reviewed absolute save path.

## 14. Availability and degradation

- Agent UI is available only in Electron V1.
- If no AI provider is configured, the dock explains the requirement and links
  to the existing API Tokens settings.
- qBittorrent query failures retain the user draft and show an inline retry.
- A provider failure does not invalidate an already prepared deterministic
  plan.
- A disconnected active server disables execution but keeps the conversation
  readable.
- Missing Helper capabilities produce an explicit unsupported-state result.

## 15. V1 acceptance criteria

### 15.1 Read-only flow

- Open Agent from the header.
- Ask for a summary of the active server.
- Observe streamed text and compact tool activity.
- Confirm the response matches the active server and current filter.
- Change server while the response is running and verify the sent message keeps
  its original context snapshot.

### 15.2 Selection flow

- Select multiple torrents and choose Ask Agent.
- Verify the draft context shows the exact selection count.
- Ask why the selected torrents are stalled.
- Verify the agent inspects only the captured hashes unless it explicitly asks
  for broader scope.

### 15.3 Mutation flow

- Ask to pause and tag selected torrents.
- Verify no mutation occurs during planning.
- Review exact targets and changes.
- Approve once and verify the supported actions execute once.
- Verify changed, skipped, and failed targets are shown separately.
- Retry the completed execution and verify it is not applied twice.

### 15.4 Stale plan flow

- Prepare a plan.
- Change a target outside Agent.
- Attempt approval and verify execution is blocked as stale with a refreshed
  preview path.

### 15.5 Destructive flow

- Prepare torrent removal without file deletion and verify destructive styling.
- Prepare removal with local-file deletion and verify a second final
  confirmation is required.
- Cancel and verify neither torrent nor files are removed.

### 15.6 Download organization preview

- Page completed torrents from the captured server.
- Read bounded qBittorrent file trees and resolve recognized and ambiguous
  metadata.
- Generate an organization preview with current and proposed values.
- Verify the first preview produces no mutation or executable plan.

### 15.7 Resilience flow

- Close and reopen the Agent dock during a run; the run remains visible.
- Stop a streaming response; the partial conversation remains readable.
- Restart the app and verify conversation history, context snapshots, plans,
  and completed operation results reload correctly.

## 16. Follow-up scope

Follow-up work is limited to executing explicitly accepted organization changes
through the existing qBittorrent plan, approval, idempotency, and audit
contracts.
