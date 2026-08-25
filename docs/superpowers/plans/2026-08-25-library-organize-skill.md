# Library-organize skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Workspace Agent can load a generic `library-organize` skill and audit, recheck, move, categorize, remove, and bulk-rename qBittorrent torrents through existing confirm cards, without breaking Helper subscribe or seeding.

**Architecture:** Copy torrent-ai's catalog + `read_skill` pattern into agent-chat only. SKILL.md is progressive disclosure. New read-only `audit_download_library`. Extend `prepare_torrent_operation` for bulk per-target rename and filtered recheck. Renderer plan cards show `old → new` per target. Do not migrate agent-chat onto message-engine.

**Tech Stack:** Pi Agent tools (`@earendil-works/pi-agent-core`), TypeBox schemas, existing `AgentTorrentOperations` + qB gateway, Vite/`?raw` for SKILL.md, vitest in `@torrent-vibe/main`.

**Spec:** `docs/superpowers/specs/2026-08-25-library-organize-skill-design.md`

## Global Constraints

- Electron workspace Agent only; torrent-ai `analyzeName` unchanged.
- No disk walks; qBittorrent API only.
- No invented save-path roots; use observed prefixes / category defaults / user-stated paths already in the queue.
- Every mutation still uses the existing plan confirm card; execute does not silently recheck (Agent must prepare a follow-up recheck plan).
- Helper torrents are those whose tags contain a token starting with `tv-mikan:`.
- Tests: `pnpm --filter @torrent-vibe/main test -- src/services/agent-chat/<file>.test.ts`
- Conventional commits. Do not add AI co-authorship. Skip git commit steps if the user has not asked to commit.
- No comments or JSDoc in business code unless an unexpected constraint.

## File map

| File | Role |
|---|---|
| `layer/main/src/services/agent-chat/skills.ts` | Index SKILL.md, XML catalog, `readSkill` |
| `layer/main/src/services/agent-chat/skills/library-organize/SKILL.md` | Generic organize playbook |
| `layer/main/src/services/agent-chat/agentTools/skillTool.ts` | `read_skill` tool |
| `layer/main/src/services/agent-chat/library-audit.ts` | Pure audit clustering |
| `layer/main/src/services/agent-chat/tools.ts` | Wire audit + read_skill + rename/recheck schemas |
| `layer/main/src/services/agent-chat/torrent-operations.ts` | Bulk rename, filtered recheck, `audit()` |
| `layer/main/src/services/agent-chat/engine.ts` | Catalog in system prompt; pass skills into tools |
| `packages/shared/src/agent-chat.ts` | `AgentOperationTarget.newName?` |
| `layer/renderer/.../AgentChatPanel.tsx` | Per-target rename label |
| `layer/main/vitest.config.ts` | `?raw` loader so tests can import SKILL.md |

---

### Task 1: Skill catalog + `library-organize` SKILL.md + `read_skill`

**Files:**
- Create: `layer/main/src/services/agent-chat/skills.ts`
- Create: `layer/main/src/services/agent-chat/skills/library-organize/SKILL.md`
- Create: `layer/main/src/services/agent-chat/agentTools/skillTool.ts`
- Create: `layer/main/src/services/agent-chat/skills.test.ts`
- Modify: `layer/main/vitest.config.ts`
- Modify: `layer/main/src/services/agent-chat/tools.ts` (`buildAgentChatTools` return list)
- Modify: `layer/main/src/services/agent-chat/engine.ts` (`renderSystemPrompt`, `buildAgentChatTools` call)

**Interfaces:**
- Consumes: torrent-ai `skills.ts` pattern (do not import from torrent-ai)
- Produces: `loadAgentChatSkillIndex(): SkillMeta[]`, `readSkill(index, name): string | null`, `renderAvailableSkillsXml(index): string`, `buildReadSkillTool(index)`, skill name `library-organize`

- [ ] **Step 1: Enable `?raw` in main vitest**

Replace `layer/main/vitest.config.ts` with:

```ts
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const PWD = fileURLToPath(new URL('./', import.meta.url))

function rawLoaderPlugin() {
  const RAW_SUFFIX = '?raw'
  return {
    name: 'raw-loader',
    resolveId(id: string, importer: string | undefined) {
      if (!id.endsWith(RAW_SUFFIX)) {
        return null
      }
      const cleaned = id.slice(0, -RAW_SUFFIX.length)
      const base = importer ? dirname(importer) : PWD
      return `${resolve(base, cleaned)}${RAW_SUFFIX}`
    },
    load(id: string) {
      if (!id.endsWith(RAW_SUFFIX)) {
        return null
      }
      const file = id.slice(0, -RAW_SUFFIX.length)
      return `export default ${JSON.stringify(readFileSync(file, 'utf8'))}`
    },
  }
}

export default defineConfig({
  plugins: [rawLoaderPlugin()],
  test: {
    globals: false,
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 2: Write SKILL.md**

Create `layer/main/src/services/agent-chat/skills/library-organize/SKILL.md`:

```md
---
name: library-organize
description: Use when the user wants to organize a qBittorrent library — missing files, duplicates, inconsistent save paths or categories, or renaming. Not for adding magnets or changing speed limits.
---

# library-organize

Generic queue organization. Do not assume Bangumi, Plex, or any one folder tree. Infer a convention from this library, confirm it, then mutate.

## When to load

User asks to organize, clean up, find missing files, unify folders, fix messy names, or similar.

## Procedure

1. Call `audit_download_library`. Do not invent save-path roots. Roots are `observedRoots` plus any path the user names that already appears on a torrent in this queue.
2. State the inferred convention in the user's language (dominant save-path template and category defaults). Give one alternative only if the library is split. Wait for confirmation before `prepare_torrent_operation`.
3. After confirmation, in order: recheck completed or error-like states → handle `missingFiles` (user chooses deleteFiles) → propose duplicates → move/category for non-Helper torrents → bulk rename if names still disagree.
4. Helper-owned torrents have a tag starting with `tv-mikan:`. Do not move them off the folder shape Helper already uses for that show (`{root}/{title}/Season XX/` with a two-digit season when that is what tagged torrents already use). Do not strip the tag. Do not remove a tagged torrent as a duplicate unless the user accepts that Helper will not re-add that Mikan episode.
5. After every executed move or rename plan, prepare a recheck plan for the same hashes. Query those hashes. If any state is `missingFiles` or `error`, stop and report. Do not silently recheck inside execute.
6. qBittorrent API only. No disk walks. Plans must be confirmed in the UI.

Layout examples (not defaults): `Show/Season XX/`, a localized show folder, flat-by-category, PT site folders. Follow this library and the user.
```

- [ ] **Step 3: Write failing catalog test**

Create `layer/main/src/services/agent-chat/skills.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { buildReadSkillTool } from './agentTools/skillTool'
import {
  loadAgentChatSkillIndex,
  readSkill,
  renderAvailableSkillsXml,
} from './skills'

describe('agent-chat skills', () => {
  it('indexes library-organize and read_skill returns the body', async () => {
    const index = loadAgentChatSkillIndex()
    expect(index.some((skill) => skill.name === 'library-organize')).toBe(true)
    const body = readSkill(index, 'library-organize')
    expect(body).toContain('audit_download_library')
    expect(body).toContain('tv-mikan:')
    const xml = renderAvailableSkillsXml(index)
    expect(xml).toContain('read_skill(name="library-organize")')
    const tool = buildReadSkillTool(index)
    const result = await tool.execute('c1', { name: 'library-organize' })
    const text = result.content[0]
    expect(text?.type === 'text' && text.text.includes('Generic queue organization')).toBe(
      true,
    )
    const missing = await tool.execute('c2', { name: 'nope' })
    const missingText = missing.content[0]
    expect(missingText?.type === 'text' && missingText.text).toBe(
      'unknown skill: nope',
    )
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @torrent-vibe/main test -- src/services/agent-chat/skills.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 5: Implement skills.ts and skillTool.ts**

Mirror `layer/main/src/services/torrent-ai/skills.ts` and `agentTools/skillTool.ts`. Differences:

- Import `libraryOrganizeSkill from './skills/library-organize/SKILL.md?raw'`
- `builtinContents` map key `library-organize`
- Export `loadAgentChatSkillIndex` (same body as `loadSkillIndex`, dirs = `resolve(here, 'skills')`)
- `buildReadSkillTool` label `'Read Skill'`, name `'read_skill'`

- [ ] **Step 6: Wire into tools + engine**

In `buildAgentChatTools`, `return [..., buildReadSkillTool(loadAgentChatSkillIndex())]` (import at top).

In `renderSystemPrompt`, after the UI context JSON block, if catalog XML is non-empty, append:

```
available_skills is the catalog of project skills. Load a full skill with read_skill when the user wants library organization, missing-file cleanup, deduping, or path/name unification.

${renderAvailableSkillsXml(loadAgentChatSkillIndex())}
```

Also append to Rules (keep existing filesystem rule):

```
- After audit_download_library, only use observedRoots, a category default save path, or a path the user stated that already exists on a torrent in this queue. Do not invent a new library root.
```

- [ ] **Step 7: Re-run tests**

Run: `pnpm --filter @torrent-vibe/main test -- src/services/agent-chat/skills.test.ts src/services/agent-chat/tools.test.ts`

Expected: PASS

- [ ] **Step 8: Commit** (skip unless the user asked)

```bash
git add layer/main/vitest.config.ts layer/main/src/services/agent-chat/skills.ts layer/main/src/services/agent-chat/skills.test.ts layer/main/src/services/agent-chat/skills/library-organize/SKILL.md layer/main/src/services/agent-chat/agentTools/skillTool.ts layer/main/src/services/agent-chat/tools.ts layer/main/src/services/agent-chat/engine.ts
git commit -m "feat: add library-organize skill catalog to workspace agent"
```

---

### Task 2: Per-target rename on plans

**Files:**
- Modify: `packages/shared/src/agent-chat.ts` (`AgentOperationTarget`)
- Modify: `layer/main/src/services/agent-chat/torrent-operations.ts`
- Modify: `layer/main/src/services/agent-chat/torrent-operations.test.ts`
- Modify: `layer/main/src/services/agent-chat/tools.ts` (rename schema)
- Modify: `layer/renderer/src/modules/agent-chat/AgentChatPanel.tsx` (`targetChange` for `rename_torrent`)

**Interfaces:**
- Consumes: existing `prepare` / `execute` / `normalizeTorrentName`
- Produces: `PrepareTorrentOperationInput.renames?: Array<{ hash: string; newName: string }>`; `AgentOperationTarget.newName?: string`; execute uses `target.newName ?? plan.newName`

- [ ] **Step 1: Write failing operations test**

Add to `torrent-operations.test.ts` (use existing `createGateway` / `torrent` helpers):

```ts
it('renames multiple torrents with per-target names', async () => {
  const fake = createGateway([
    torrent('a', 'Old A', 'stoppedUP'),
    torrent('b', 'Old B', 'stoppedUP'),
  ])
  const operations = new AgentTorrentOperations(fake.gateway)
  const plan = await operations.prepare(
    {
      action: 'rename_torrent',
      renames: [
        { hash: 'a', newName: 'New A' },
        { hash: 'b', newName: 'New B' },
      ],
    },
    [],
  )
  expect(plan.targets.map((target) => target.newName)).toEqual(['New A', 'New B'])
  const result = await operations.execute(plan.id)
  expect(result.ok).toBe(true)
  expect(fake.rename).toHaveBeenCalledWith('server-a', 'a', 'New A')
  expect(fake.rename).toHaveBeenCalledWith('server-a', 'b', 'New B')
})
```

Keep single-hash `{ action: 'rename_torrent', newName }` working (existing callers).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @torrent-vibe/main test -- src/services/agent-chat/torrent-operations.test.ts`

Expected: FAIL (unknown `renames` / still "exactly one torrent")

- [ ] **Step 3: Implement types + prepare/execute**

`packages/shared/src/agent-chat.ts` on `AgentOperationTarget`:

```ts
newName?: string
```

`PrepareTorrentOperationInput` add:

```ts
renames?: Array<{ hash: string; newName: string }>
```

`normalizeOperation` for rename:

- If `input.renames?.length`, map each `newName` through `normalizeTorrentName`, require 1–50 unique hashes.
- Else existing single `newName`.

Remove `hashes.length !== 1` throw. If `renames` present, `prepare` uses those hashes (ignore empty `requestedHashes`).

`needsAction` for rename: `torrent.name !== nameFor(hash)` where `nameFor` is the per-hash new name or `operation.newName`.

When building targets, set `newName` on each target.

Execute:

```ts
await this.gateway.rename(
  scopeKey,
  target.hash,
  target.newName ?? plan.newName!,
)
```

Tool schema: replace the single-hash rename object with a union member:

```ts
Type.Object({
  action: Type.Literal('rename_torrent'),
  hashes: Type.Optional(
    Type.Array(Type.String(), { minItems: 1, maxItems: 1 }),
  ),
  newName: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  renames: Type.Optional(
    Type.Array(
      Type.Object({
        hash: Type.String({ minLength: 1 }),
        newName: Type.String({ minLength: 1, maxLength: 255 }),
      }),
      { minItems: 1, maxItems: 50 },
    ),
  ),
})
```

In `prepareOperation.execute`, if `params.action === 'rename_torrent' && params.renames`, pass `renames` into `operations.prepare` and hashes from `params.renames.map(r => r.hash)`.

Renderer `targetChange` rename branch:

```ts
return `${target.name} → ${target.newName ?? plan.newName}`
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @torrent-vibe/main test -- src/services/agent-chat/torrent-operations.test.ts src/services/agent-chat/tools.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (skip unless asked)

```bash
git add packages/shared/src/agent-chat.ts layer/main/src/services/agent-chat/torrent-operations.ts layer/main/src/services/agent-chat/torrent-operations.test.ts layer/main/src/services/agent-chat/tools.ts layer/renderer/src/modules/agent-chat/AgentChatPanel.tsx
git commit -m "feat: allow bulk per-target torrent rename plans"
```

---

### Task 3: Filtered recheck plans

**Files:**
- Modify: `layer/main/src/services/agent-chat/torrent-operations.ts`
- Modify: `layer/main/src/services/agent-chat/torrent-operations.test.ts`
- Modify: `layer/main/src/services/agent-chat/tools.ts` (recheck schema)

**Interfaces:**
- Consumes: existing `query()`
- Produces: `prepare({ action: 'recheck', completedOnly?: boolean, states?: string[], offset?: number }, hashes)` resolves hashes via `query` when hashes empty

- [ ] **Step 1: Write failing test**

```ts
it('prepares recheck for completed torrents without explicit hashes', async () => {
  const fake = createGateway([
    torrent('done', 'Done', 'stoppedUP', { progress: 1 }),
    torrent('dl', 'Down', 'downloading', { progress: 0.2 }),
  ])
  const operations = new AgentTorrentOperations(fake.gateway)
  const plan = await operations.prepare(
    { action: 'recheck', completedOnly: true },
    [],
  )
  expect(plan.targets.map((target) => target.hash)).toEqual(['done'])
  const result = await operations.execute(plan.id)
  expect(result.ok).toBe(true)
  expect(fake.recheck).toHaveBeenCalledWith('server-a', ['done'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @torrent-vibe/main test -- src/services/agent-chat/torrent-operations.test.ts`

Expected: FAIL (`No torrent targets were provided`)

- [ ] **Step 3: Implement**

Add to `PrepareTorrentOperationInput`: `completedOnly?: boolean`, `states?: string[]`, `offset?: number`.

At start of `prepare`, if `normalizeHashes(requestedHashes).length === 0` and (`completedOnly` or `states?.length`):

```ts
const matched = await this.query(
  {
    completedOnly: operationInput.completedOnly,
    states: operationInput.states,
    limit: MAX_OPERATION_TARGETS,
    offset: operationInput.offset ?? 0,
  },
  scopeKey,
)
requestedHashes = matched.map((item) => item.hash)
```

Keep the empty-hash error if still empty.

Tool: extend recheck object:

```ts
Type.Object({
  action: Type.Literal('recheck'),
  hashes: operationHashes,
  completedOnly: Type.Optional(Type.Boolean()),
  states: Type.Optional(Type.Array(Type.String())),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
})
```

Pass those fields into `operations.prepare`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @torrent-vibe/main test -- src/services/agent-chat/torrent-operations.test.ts src/services/agent-chat/tools.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (skip unless asked)

```bash
git add layer/main/src/services/agent-chat/torrent-operations.ts layer/main/src/services/agent-chat/torrent-operations.test.ts layer/main/src/services/agent-chat/tools.ts
git commit -m "feat: prepare recheck plans from completed or state filters"
```

---

### Task 4: `audit_download_library`

**Files:**
- Create: `layer/main/src/services/agent-chat/library-audit.ts`
- Create: `layer/main/src/services/agent-chat/library-audit.test.ts`
- Modify: `layer/main/src/services/agent-chat/torrent-operations.ts` (`audit` method + optional `content_path` on list)
- Modify: `layer/main/src/services/agent-chat/tools.ts`
- Modify: `layer/main/src/services/agent-chat/tools.test.ts`

**Interfaces:**
- Consumes: `gateway.list(): TorrentInfo[]`
- Produces:

```ts
export type LibraryAuditIssueKind =
  | 'missing_files'
  | 'duplicate'
  | 'path_category_mismatch'
  | 'layout_inconsistent'
  | 'helper_managed'
  | 'uncategorized'

export interface LibraryAuditIssue {
  kind: LibraryAuditIssueKind
  hash: string
  name: string
  savePath: string
  category: string
  tags: string[]
  detail: string
  memberHashes?: string[]
}

export interface LibraryAuditResult {
  observedRoots: string[]
  byCategory: Record<string, number>
  byState: Record<string, number>
  issues: LibraryAuditIssue[]
  helper: Array<{ savePath: string; hashes: string[] }>
}
```

`AgentTorrentOperations.audit(input: { hashes?: string[]; limit?: number; offset?: number }, scopeKey?): Promise<LibraryAuditResult>`

- [ ] **Step 1: Write failing unit tests**

`library-audit.test.ts` tests the pure function `auditTorrents(torrents: TorrentInfo[]): LibraryAuditResult` (export it from `library-audit.ts`).

Cases:

1. `missingFiles` / `error` → `missing_files`
2. Two torrents whose stripped names match (`[Group] Show - 01.mkv` vs `[Other] Show - 01.mkv`) → one `duplicate` issue with `memberHashes` length 2
3. Tag `tv-mikan:abc` → `helper_managed` (not a reason to delete)
4. `save_path` `/downloads/Bangumi/Show/Season 1` and `/downloads/Bangumi/Show/Season 01` → `observedRoots` includes `/downloads/Bangumi/Show`; `layout_inconsistent` for that series cluster
5. Empty category → `uncategorized`
6. Category `Movie` with path under a different cluster than other Movie torrents (e.g. `/downloads/PT/Books` vs `/downloads/Movie`) → `path_category_mismatch`

Strip helper for tests: lowercase; remove `\[[^\]]*\]`; collapse whitespace; use `content_path` basename without extension if `content_path` looks like a file (has a video extension), else torrent `name`.

Season strip for roots: replace `/Season \d+$` (case-insensitive) on `save_path`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @torrent-vibe/main test -- src/services/agent-chat/library-audit.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement `auditTorrents` and `operations.audit`**

`operations.audit`: `list` all (or hashes), slice by offset/limit (default limit 200, max 500), run `auditTorrents`.

Tool `audit_download_library`: TypeBox `{ hashes?, limit?, offset? }`, execute `operations.audit(...)`, `textResult` the JSON.

Add to `buildAgentChatTools` return array.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @torrent-vibe/main test -- src/services/agent-chat/library-audit.test.ts src/services/agent-chat/tools.test.ts`

Expected: PASS. Add one tools.test.ts case: audit tool calls `operations.audit` and does not call `onPlan`.

- [ ] **Step 5: Commit** (skip unless asked)

```bash
git add layer/main/src/services/agent-chat/library-audit.ts layer/main/src/services/agent-chat/library-audit.test.ts layer/main/src/services/agent-chat/torrent-operations.ts layer/main/src/services/agent-chat/tools.ts layer/main/src/services/agent-chat/tools.test.ts
git commit -m "feat: add audit_download_library tool for workspace agent"
```

---

### Task 5: Typecheck + AgentChatPanel rename row smoke

**Files:**
- Modify: already-touched renderer rename label if Task 2 missed locales (no new keys required)
- Verify: `packages/shared` export of `AgentOperationTarget`

- [ ] **Step 1: Typecheck changed packages**

Run:

```
pnpm --filter @torrent-vibe/shared exec tsc -p tsconfig.json --noEmit
pnpm --filter @torrent-vibe/main typecheck
pnpm --filter @torrent-vibe/renderer typecheck
```

Expected: no errors related to `newName`, `renames`, `audit`, `read_skill`

If renderer `targetChange` still uses only `plan.newName`, fix to `target.newName ?? plan.newName` (Task 2).

- [ ] **Step 2: Run the full agent-chat test glob**

Run: `pnpm --filter @torrent-vibe/main test -- src/services/agent-chat`

Expected: all PASS

- [ ] **Step 3: Manual Electron check** (when `pnpm dev:electron` is up)

Open Agent, ask to organize. Confirm it calls `read_skill` then `audit_download_library` (tool chips). Do not execute destructive plans in this task.

- [ ] **Step 4: Commit** (skip unless asked)

```bash
git add -u
git commit -m "feat: add library-organize skill for workspace agent"
```

(Prefer one squashed commit at the end if Tasks 1–4 already committed.)

---

## Spec coverage

| Spec item | Task |
|---|---|
| Catalog + `read_skill` + SKILL.md | 1 |
| Generic convention, observed roots, no invented root | 1 (skill + prompt), 4 (audit) |
| Bulk rename per target + UI | 2 |
| Recheck completedOnly/states | 3 |
| Follow-up recheck is Agent/skill, not silent execute | 1 (skill text) |
| Helper `tv-mikan:` | 1 (skill), 4 (issue kind) |
| `audit_download_library` | 4 |
| torrent-ai unchanged | 1 (separate dir) |
| No message-engine migration | all |
| Plan card per-target rename | 2 |

## Placeholder scan

No TBD/TODO. Test commands are exact. Types named in later tasks are defined in Task 2/4 Interfaces.
