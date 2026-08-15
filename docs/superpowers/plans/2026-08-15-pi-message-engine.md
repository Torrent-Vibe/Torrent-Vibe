# Pi + message-engine Implementation Plan

> **For agentic workers:** Execute inline with typecheck after each batch. No unit-test suite in this repo.

**Goal:** Replace Vercel AI SDK in torrent-ai with Pi + message-engine, Kansoku skill pipeline, Codex search, and session affinity.

**Architecture:** Short-lived Pi Agent per `analyzeName`. message-engine injects system prompt + skill catalog. Tools are `read_skill`, TMDB, and Codex-backed `webSearch`.

**Tech Stack:** `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `@innei/message-engine`, existing zod schema.

---

### Task 1: Dependencies
- Add `pi-ai`, `pi-agent-core`, `@innei/message-engine`
- Remove `ai`, `@ai-sdk/openai`, `@openrouter/ai-sdk-provider`

### Task 2: Shared + settings
- `AI_PROVIDER_IDS` += `codex`
- Token slots `ai.codex.apiKey`, `ai.codex.model`
- Locales, renderer definitions, error maps, model manager

### Task 3: Skills pipeline
- `skills.ts` index/read (Kansoku)
- `agentTools/skillTool.ts` `read_skill`
- `skills/agent-browser/SKILL.md`
- Catalog XML helper

### Task 4: Providers
- Rewrite runtime to Pi Models/Model/apiKey/affinity
- openai / openrouter / new codex adapters

### Task 5: Tools + session + engine
- TMDB as AgentTool
- `webSearch` via Codex
- session.ts + engine.ts swap
- Delete headless search / webExtract tool

### Task 6: Verify
- typecheck main + renderer
- no leftover Vercel AI SDK imports
