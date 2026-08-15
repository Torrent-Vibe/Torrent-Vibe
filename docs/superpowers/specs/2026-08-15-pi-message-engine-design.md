# Replace Vercel AI SDK with Pi + message-engine

Date: 2026-08-15

## Goal

Remove Vercel AI SDK from torrent-ai. Run one-shot `analyzeName` on
`@earendil-works/pi-ai` + `@earendil-works/pi-agent-core`, with
`@innei/message-engine` compiling the single-turn context. Keep the IPC
contract, provider preference order, TMDB tools, zod metadata schema, and
SQLite cache.

## Decisions

1. Scope is option C: delete `ai` / `@ai-sdk/*` / `@openrouter/ai-sdk-provider`
   now. message-engine is wired for a single turn. Multi-turn sessions are
   later.
2. Each `analyzeName` creates a short-lived Pi `Agent` + message-engine
   session and `destroy()`s it in `finally`.
3. Structured output is not `Output.object`. Final assistant text is parsed
   with the existing `normalizePayloadShape` + `TorrentAiMetadataSchema`
   recovery path.
4. Send a per-run session id so OpenRouter (and other gateways) pin the same
   downstream model provider across tool-loop steps. Header is `x-session-id`.
5. Add a `codex` provider adapter using Pi's OpenAI Codex provider.
6. Delete headless Chrome search. Web search is a first-class Agent tool
   whose provider is always Codex, independent of which chat provider
   `selectProvider` picked.
7. Skills follow Kansoku's agent pipeline (`packages/core/src/ai/agents`
   + `conversation/messages/sharedProviders.ts`): index SKILL.md files,
   inject `<available_skills>`, load full text only via `read_skill(name)`.
   agent-browser is one catalog skill, not a TypeScript-wrapped tool.

## Out of scope

- Multi-turn chat / persistent message-engine sessions
- Token cost UI / message-engine devtools
- Giving the harness bash / read_file / write / grep (only `read_skill`
  plus product and Codex search tools)
- Implementing a custom agent-browser execute wrapper
- New provider families beyond OpenAI, OpenRouter, Codex

## Runtime shape

```
ApiTokenStore / AppSettingsStore
        ↓
selectProvider (openai | openrouter | codex)
        ↓
{ models, model, apiKey, sessionId, affinity }
        ↓
createPiMessageEngine  (one session per analyzeName)
  system: SYSTEM_ANALYZE_PROMPT + JSON schema instruction
  user-augmentation: file tree summary when present
        ↓
Agent.prompt(userPrompt)
  tools:
    harness: read_skill(name)
    product: tmdbSearch, tmdbDetails
    search:  webSearch  (Codex provider only, if Codex is configured)
  context injectors (message-engine, Kansoku-shaped):
    available_skills catalog
    optional activated_skills (none for analyzeName)
  thinkingLevel: minimal
  toolExecution: parallel
  sessionId + sendSessionAffinityHeaders
  shouldStopAfterTurn after 50 steps
        ↓
parse last assistant text → existing mapper / cache
        ↓
engine.destroy()
```

## Session affinity

Each `analyzeName` execution allocates `sessionId = crypto.randomUUID()`.
That id is reused for every LLM call inside that Agent run (tool-loop
continuations). It is not reused across different torrents.

Pass it to Pi as `Agent` `sessionId`. On every stream/complete:

- `sendSessionAffinityHeaders: true`
- `sessionAffinityFormat`:
  - `openrouter` → Pi sends `x-session-id` (OpenRouter provider pinning)
  - `openai` → `prompt_cache_key` / `session_id` / `x-session-affinity`
  - `codex` → Pi Codex session cache (`sessionId` on stream options)
- OpenRouter also keeps existing `HTTP-Referer` and `X-Title` via
  `transformHeaders`

This is only for one analysis's tool loop. Cache keys for metadata SQLite
stay `language::provider:model::rawName::ft=digest`.

## Providers

`AI_PROVIDER_IDS` becomes `['openai', 'openrouter', 'codex']`.
`DEFAULT_AI_PROVIDER_ORDER` follows that array. Settings preference selector
and `AppSettingsStore` pick up the new id automatically.

`AiProviderRuntime` no longer holds a Vercel `LanguageModel`. It holds:

- `id`, `modelId`, `errorNamespace`
- Pi `Models` collection + `Model`
- explicit `apiKey` (never env fallback)
- `sessionAffinityFormat`

### openai

`openaiProvider()` when model is in the built-in catalog and `baseUrl` is
empty. Custom `baseUrl` or unknown model id: `createProvider` +
`openai-completions` so users can still paste any gateway URL / model string.

### openrouter

`openrouterProvider()`. Unknown model ids use `createProvider` against
OpenRouter's OpenAI-compatible endpoint. Always send Referer, Title, and
`x-session-id`.

### codex

New `CodexProviderAdapter`. Uses Pi's OpenAI Codex provider factory.
Codex is ChatGPT OAuth, not an API key. Settings only expose
`ai.codex.model` (optional). Auth is resolved by Pi's
`openaiCodexProvider()` OAuth at request time. Do not add an API key slot.

`isConfigured` is always true so Codex can be preferred / used for
`webSearch` without a token form. If OAuth is missing, the request fails
with `ai.codex.requestFailed`.

Transient / unexpected: `ai.codex.requestFailed` /
`ai.codex.unexpectedError`.

## Skill pipeline (Kansoku)

Copy the Kansoku shape, not Pi coding-agent's generic `createReadTool`.

Reference:

- `kansoku/packages/core/src/ai/agents/skills.ts`
- `kansoku/packages/core/src/ai/agents/agentTools/skillTool.ts`
- `kansoku/packages/core/src/ai/conversation/messages/sharedProviders.ts`

### Index

`loadSkillIndex(dirs)` scans one-level child directories for `SKILL.md`,
parses YAML frontmatter `name` + `description`, dedupes by name. Search
dirs for torrent-ai:

- packaged: `layer/main/src/services/torrent-ai/skills` (dev) /
  staged skills dir in the Electron bundle
- optional later: user override dir (not in this change)

`readSkill(index, name)` returns the full SKILL.md text or null.

### Catalog injection

A message-engine processor equivalent to Kansoku `SkillCatalogProvider`
injects first-user (or `user-augmentation`) XML:

```xml
<available_skills>
  <skill name="agent-browser" status="available" location="...">
    <description>...</description>
    <invoke>read_skill(name="agent-browser")</invoke>
  </skill>
</available_skills>
```

Do not dump skill bodies into the system prompt. Progressive disclosure
only. `ActivatedSkillsProvider` exists for later runs that pre-load a
skill; `analyzeName` activates none.

Prompt policy one-liner (Kansoku `prompts.ts`): `available_skills` is the
catalog; load a full skill with `read_skill` when needed.

### Harness tool: `read_skill`

Same contract as Kansoku `buildReadSkillTool`:

- name: `read_skill`
- params: `{ name: string }`
- execute: `readSkill(index, name)` or `"unknown skill: <name>"`
- no path argument, no repo-wide filesystem read

Do not add Kansoku's `read_file` / `bash` / `grep` in this change.

### Internal skill: agent-browser

Ship `layer/main/src/services/torrent-ai/skills/agent-browser/SKILL.md`
with frontmatter `name` + `description`. Body is CLI guidance only. It is
not an AgentTool. Existing `webExtractReadable` wrapper is deleted.

Settings Agent Browser path can stay for the rest of the app; torrent-ai
does not call it.

### Product: TMDB

Rewrite `tmdbSearch` and `tmdbDetails` as Pi `AgentTool` + TypeBox. Keep
current execute bodies.

### Search: `webSearch` (provider = Codex)

A separate tool, not a chat-provider feature.

- Name: `webSearch`
- Args: `query`, optional `language`, optional `maxResults`
- Execute always uses the Codex adapter (Pi OpenAI Codex + stored
  `ai.codex.apiKey`), even when the analysis chat model is OpenAI or
  OpenRouter
- Same `x-session-id` as the parent analysis run so Codex/OpenRouter-style
  pinning stays consistent if the Codex path also honors session headers
- If Codex is not configured, do not register `webSearch`

Delete all headless Chrome search: Google / DuckDuckGo navigation,
extractors, `createSearchTools`, `executeHeadlessSearch`, `searchGoogle`,
`searchDuckDuckGo`, `searchWithEngine`, `openai.tools.webSearch`, and
`buildAiTools({ search: { mode: 'headless' } })`.

## Prompts and parsing

Keep `renderSystemPrompt` / `renderUserPrompt`. Add a system-phase
instruction that the last assistant message must be a single JSON object
matching `TorrentAiMetadataSchema`.

After `agent.prompt`, take the last assistant text block. Parse JSON,
`normalizePayloadShape`, `safeParse`. On failure return
`ai.<provider>.unexpectedError` (same as failed `NoObjectGeneratedError`
recovery today). Drop the `NoObjectGeneratedError` type import.

## message-engine

One `createPiMessageEngine` per analysis.

- `system`: analysis prompt + JSON constraint + available_skills policy line
- `user-augmentation`: SkillCatalogProvider XML + file-tree summary
- `createPiSystemPromptBridge` so Pi sees the compiled system prompt
- OpenRouter path may use `createPiOpenRouterPromptCacheBridge` together
  with `x-session-id`

`strict: true`. `destroy()` in `finally`.

## Files

Touch:

- `layer/main/src/services/torrent-ai/engine.ts`
- `layer/main/src/services/torrent-ai/tools.ts`
- `layer/main/src/services/torrent-ai/search.ts` (replace with Codex
  `webSearch` tool)
- `layer/main/src/services/torrent-ai/web-extract.ts` (stop using as an
  Agent tool; delete if nothing else imports it)
- `layer/main/src/services/torrent-ai/skills.ts` (new, Kansoku index/read)
- `layer/main/src/services/torrent-ai/skills/agent-browser/SKILL.md` (new)
- `layer/main/src/services/torrent-ai/agentTools/skillTool.ts` (new,
  `read_skill`)
- `layer/main/src/services/torrent-ai/providers/*` (types, openai,
  openrouter, new `codex-provider.ts`, registry)
- `layer/main/src/services/torrent-ai/session.ts` (new)
- `packages/shared/src/ai.ts`, `packages/shared/src/api-tokens.ts`
- renderer token definitions + settings locales (en / zh-CN)
- `layer/main/package.json` deps

Do not change renderer analyze UI, cache DB schema, or IPC method names.

## Dependencies

Add:

- `@earendil-works/pi-ai`
- `@earendil-works/pi-agent-core`
- `@innei/message-engine`

Remove:

- `ai`
- `@ai-sdk/openai`
- `@openrouter/ai-sdk-provider`

Keep `zod`.

## Errors

Existing keys stay valid. Add Codex siblings:

- `ai.codex.missingApiKey`
- `ai.codex.requestFailed`
- `ai.codex.unexpectedError`

Empty name and no-provider paths unchanged. Transient classification still
looks for 429 / timeout / ETIMEDOUT / ECONNRESET.

## Acceptance

- `pnpm -F @torrent-vibe/main typecheck` and renderer typecheck pass
- Repo has no imports from `ai`, `@ai-sdk/*`, `@openrouter/ai-sdk-provider`
- `search.ts` no longer launches agent-browser for Google/DDG
- Unconfigured chat provider: `isAvailable()` false; `analyzeName` still
  returns `ai.providers.unavailable` or the first missing-key error
- Configured OpenAI / OpenRouter / Codex: tool loop runs; metadata shape
  unchanged for the renderer
- A single analysis's OpenRouter requests share one `x-session-id`
- Settings can select Codex in the preferred-provider list
- `webSearch` is registered only when Codex is configured, and its execute
  path uses Codex, not the chat provider
- Agent tools include `read_skill`; agent-browser is only reachable as a
  catalog skill via `read_skill(name)`, not as a TS tool
- Prompt contains `<available_skills>` catalog, not full SKILL.md bodies

## Follow-ups

- Interactive Codex OAuth button if token paste is insufficient
- Multi-turn message-engine sessions
- Optional bash/execute if the agent-browser skill later needs a runner
