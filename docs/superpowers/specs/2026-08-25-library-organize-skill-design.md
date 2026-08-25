# Workspace Agent: generic library-organize skill

Date: 2026-08-25

## Goal

Give the workspace Agent (agent-chat) a built-in skill for organizing a
qBittorrent queue: audit, recheck, handle missing files, dedupe, move,
set category, and bulk-rename. The skill is **generic**. One user's folder
tree is only an example, never the default layout.

Every mutation still goes through an existing confirmation plan card.
After move/rename batches, the Agent must recheck those hashes and report
seeding health. Helper-managed torrents (`tv-mikan:` tags) must not be
rearranged in a way that splits a subscribed show or blocks auto-subscribe.

## Decisions

1. Ship as a **workspace-agent catalog skill**, same progressive-disclosure
   pattern as torrent-ai: system prompt lists `<available_skills>`; full
   `SKILL.md` loads only via `read_skill(name)`.
2. Skill lives at
   `layer/main/src/services/agent-chat/skills/library-organize/SKILL.md`.
   Do not put it under torrent-ai skills. torrent-ai `analyzeName` is
   unchanged.
3. Agent-chat gets its own small skill index + `read_skill` tool. Do not
   merge torrent-ai and agent-chat skill loaders in this change.
4. Convention is **per conversation**, confirmed by the user:
   inspect the live queue → propose a scheme from dominant existing
   paths / category default save paths / the user's words → wait for
   confirmation → then mutate.
5. Paths may only use **observed roots** (prefixes that already exist on
   torrents in this queue, or a qBittorrent category's configured save
   path). The Agent must not invent a new library root.
6. Bulk rename is in v1: `renames: [{ hash, newName }]` up to 50 per plan.
   Plan cards show per-target `old → new`.
7. After every executed **move** or **rename** plan, the Agent prepares a
   follow-up **recheck** plan for the same hashes (user confirms that card
   too). Then `query_torrents` those hashes. If any are `missingFiles` or
   `error`, stop further organize batches and surface it. Execute does not
   silently recheck.
8. Helper safety is in v1. Torrents tagged `tv-mikan:` are Helper-owned.
   Default: do not move them off Helper's `{libraryRoot}/{title}/Season XX/`
   shape, do not strip the tag, do not delete them as dupes unless the user
   explicitly confirms that this episode will not be re-added.

## Out of scope

- Migrating agent-chat onto `@innei/message-engine`
- Changing Helper config (`libraryRoot`, category, replica titles)
- Disk walks outside qBittorrent; orphan-file cleanup
- Per-file `renameFile` / `renameFolder` via the workspace Agent
- Auto-executing plans without the existing UI confirm card
- A settings UI for "library layout"
- iOS / web Agent (Electron workspace Agent only, same as today)

## Runtime

```
user message
  → Agent (existing agent-chat Pi Agent)
      system: existing rules
              + available_skills catalog (not skill bodies)
              + locale
              + current UI context JSON (unchanged this change)
      tools:
        read_skill(name)
        query_torrents / inspect_torrents / resolve_media_metadata
        preview_download_organization (unchanged contract)
        audit_download_library          (new, read-only)
        prepare_torrent_operation       (extended rename + recheck selector)
  → plan cards in the renderer (per-target rename text)
  → execute existing AgentTorrentOperations
  → follow-up recheck + query of touched hashes
```

When the user asks to organize, clean up, find missing files, unify
folders, or fix messy names, the Agent must `read_skill(name="library-organize")`
before preparing mutations.

## Skill body (library-organize)

Frontmatter `name: library-organize`. Description must say when to load it
(organize / missing files / duplicates / inconsistent save paths / rename
a library) and that it is not for adding magnets or changing speed limits.

The SKILL.md states:

1. **Audit first.** Call `audit_download_library` (and `query_torrents` as
   needed). Do not prepare moves from memory of a previous turn's paths.
2. **Confirm a convention** in the user language. Present the inferred
   scheme (dominant save-path template + category defaults) and wait.
   Examples in the skill (Plex/Sonarr `Show/Season XX`, a bangumi-style
   tree, flat-by-category, PT layout) are illustrations only.
3. **Order after confirmation:** recheck completed or error-like states →
   handle `missingFiles` (remove vs keep files — user chooses) → propose
   dupes → move/category for non-Helper torrents → bulk rename if names
   still disagree with the confirmed scheme.
4. **Helper-owned torrents** (`tags` contain `tv-mikan:`): treat Helper as
   the writer for that show. Prefer leaving path/category/tag aligned with
   Helper (`Season` padded to two digits under Helper `libraryRoot` when
   that root is knowable from existing tagged torrents). Do not delete a
   tagged torrent as a duplicate unless the user accepts that Helper will
   not re-download that episode (Helper stores the Mikan episode id).
5. **After each mutating plan succeeds:** recheck those hashes; report
   states. Abort the organize sequence on new `missingFiles`/`error`.
6. **Never** invent a save-path root, mix unrelated libraries, or run
   bash/disk tools.

## Tools

### `read_skill`

Same contract as torrent-ai `buildReadSkillTool`: `{ name: string }` →
SKILL.md text or `unknown skill: <name>`. Index only
`layer/main/src/services/agent-chat/skills/*`.

### `audit_download_library` (new, read-only)

Input (all optional filters): `hashes`, `limit` (default 200, max 500),
`offset`.

Output JSON (bounded, not a dump of every torrent field):

- `observedRoots`: sorted unique strings, union of
  (a) each torrent `savePath` with a trailing `/Season <number>` or
  `/Season <zero-padded>` segment stripped, else the `savePath` itself;
  (b) each qBittorrent category's configured save path when the gateway
  can read categories
- `byCategory`, `byState` counts
- `issues[]` with `kind`, `hash`, `name`, `savePath`, `category`, `tags`,
  `detail`
  - `missing_files` — qB state `missingFiles` or `error`
  - `duplicate` — same normalized episode/title key, multiple hashes
  - `path_category_mismatch` — category vs path cluster
  - `layout_inconsistent` — same series/category, different folder templates
  - `helper_managed` — `tv-mikan:` tag (informational grouping, not an error)
  - `uncategorized`
- `helper`: tagged torrents grouped by inferred show folder

No filesystem access. Duplicate groups: normalize by taking the file stem
of `content_path` when it looks like a single file, else the torrent
`name`; strip bracket tags `[...]` and collapse whitespace/case. Groups
with two or more hashes become `kind: duplicate` with all member hashes
listed. The Agent must not delete members without an explicit user choice.

### `prepare_torrent_operation` extensions

**Recheck selector.** Allow either explicit `hashes` (existing, max 50) or
`completedOnly: true` / `states: string[]` without hashes. The operations
layer resolves the matching queue (cap 50, page with offset if needed) and
builds a normal recheck plan. Plans still list concrete targets.

**Bulk rename.** New variant:

```
{ action: "rename_torrent", renames: [{ hash, newName }] }
```

- 1–50 entries; each `newName` uses the existing torrent-name normalizer
- `AgentOperationTarget` gains optional `newName`
- Execute uses `target.newName` (fallback `plan.newName` for one-target
  plans so old payloads still work)
- Renderer plan card: `target.name → target.newName ?? plan.newName`

Move, category, remove, pause, tags, limits: unchanged caps (50 hashes,
remove still requires `deleteFiles`).

Move `savePath` must be an absolute qB path. The skill forbids roots that
are not in `observedRoots` or a category default; the operations layer
does not need to enforce that list (Agent + skill + user confirm). Invalid
empty paths still fail existing `normalizeSavePath`.

## Renderer

- Plan card rename row uses per-target names.
- No new organize wizard. No new settings tab.
- Composer context chips and snapshot chips unchanged.

## Prompt

`renderSystemPrompt` for agent-chat:

- Keep current UI context JSON and operation rules.
- Append: `available_skills` is the catalog; load with `read_skill` when
  the user wants library organization, missing-file cleanup, deduping, or
  path/name unification.
- Inject `renderAvailableSkillsXml(index)` when the index is non-empty.
- Keep: no arbitrary filesystem; plans must be confirmed in the UI.
- Relax only the implied "never invent a destination root" into: do not
  invent a root; after audit, use observed roots / category defaults /
  user-stated paths that already exist in the queue.

## Tests

- Skill index finds `library-organize`; `read_skill` returns the body.
- `audit_download_library` flags missingFiles, duplicate names, and
  `tv-mikan:` grouping on a fake gateway list.
- Rename plan with two `{hash,newName}` executes two `gateway.rename` calls
  with the per-target names; card mapping uses `target.newName`.
- Recheck with `completedOnly` selects completed torrents up to 50.
- Removing a `tv-mikan:` torrent as a duplicate is not implied by audit
  output (issue kind is `helper_managed` or duplicate members include the
  tag so the skill can refuse by default). No Helper process is started in
  unit tests.

## Files

- `layer/main/src/services/agent-chat/skills.ts` (index + xml, mirror torrent-ai)
- `layer/main/src/services/agent-chat/skills/library-organize/SKILL.md`
- `layer/main/src/services/agent-chat/agentTools/skillTool.ts` (or colocate in `tools.ts` if under ~30 lines)
- `layer/main/src/services/agent-chat/tools.ts` — audit tool, prompt catalog, rename schema
- `layer/main/src/services/agent-chat/torrent-operations.ts` — bulk rename, recheck filters
- `layer/main/src/services/agent-chat/engine.ts` — skills in system prompt + tools
- `packages/shared/src/agent-chat.ts` — `AgentOperationTarget.newName?`
- `layer/renderer/src/modules/agent-chat/AgentChatPanel.tsx` — per-target rename label
- tests next to operations/tools

## PR plan

One PR. Conventional commit: `feat: add library-organize skill for workspace agent`.
Platform: Electron (workspace Agent). UI: plan card rename row only.
