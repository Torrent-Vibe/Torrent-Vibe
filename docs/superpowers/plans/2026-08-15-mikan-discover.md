# Mikan Discover + Host Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bangumi-first Mikan Discover shell in Electron and a per-host helper that follows subscriptions, adds episodes to local qBittorrent, and renames files on completion.

**Architecture:** Torrent-Vibe owns the subscription list and Discover UI. Each qBittorrent server may pair a helper sidecar. The helper is the only executor (no qBittorrent RSS). Shared types live in `packages/helper-protocol`. Mikan HTML/RSS parsing lives in `packages/mikan` so the renderer provider and the helper share one parser.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, existing DiscoverProvider interface, qBittorrent WebAPI via `@torrent-vibe/qb-client` / `@innei/qbittorrent-browser`, Node HTTP helper, Docker.

**Spec:** `docs/superpowers/specs/2026-08-15-mikan-discover-design.md`

## Global Constraints

- iOS is out of scope. Helper HTTP must stay a plain JSON API a later iOS client can call.
- Do not create qBittorrent RSS feeds or rules.
- Electron still talks to qBittorrent WebAPI directly for the torrent list and single-episode import.
- No NFO, posters, fanart, or media-library index.
- Do not rename torrents the helper did not add.
- No Mikan account / MyBangumi token. Configurable base URL only.
- Torrent-Vibe subscriptions are the source of truth. Helpers hold execution replicas. Desired-state push is last-write-wins from Electron.
- Last Discover provider id is persisted locally. Unready last provider falls back to the first ready provider and rewrites memory.
- Mikan search returns bangumi only. Empty query = selected season wall. Non-empty = site-wide bangumi search.
- Helper default listen port is `17890`. mDNS type is `_torrentvibe-helper._tcp`.
- Episode file name format is `{title} - SxxExx.ext`. Save path is `{libraryRoot}/{title}/Season {XX}/`.
- Unparseable titles must be `needs-manual` and must not be renamed to `S00E00`.
- Zero comments / JSDoc in business code unless the behavior is unexpected.
- TDD: failing test first for every new behavior. This repo has no test runner yet — add Vitest on the packages you create/touch.
- Follow existing Discover store/actions and settings patterns. Do not rewrite M-Team Discover except the provider memory + dropdown behavior.
- Commit after each task. Do not commit unrelated dirty files already on the machine (`layer/main/package.json` etc.).
- Never add AI co-authorship trailers.

---

### Task 1: helper-protocol types and desired-state diff

**Files:**
- Create: `packages/helper-protocol/package.json`
- Create: `packages/helper-protocol/tsconfig.json`
- Create: `packages/helper-protocol/vitest.config.ts`
- Create: `packages/helper-protocol/src/index.ts`
- Create: `packages/helper-protocol/src/types.ts`
- Create: `packages/helper-protocol/src/desired-state.ts`
- Create: `packages/helper-protocol/src/desired-state.test.ts`
- Modify: `packages/shared/src/index.ts` — do **not** re-export helper-protocol from shared unless needed. Prefer direct `@torrent-vibe/helper-protocol` dependency later.

**Interfaces:**
- Consumes: nothing
- Produces:

```ts
export type HelperEpisodeState =
  | 'pending'
  | 'added'
  | 'downloading'
  | 'renaming'
  | 'done'
  | 'failed'
  | 'needs-manual'

export interface SubscriptionRecord {
  id: string
  providerId: 'mikan'
  bangumiId: string
  title: string
  coverUrl?: string
  bangumiSubjectId?: string
  subgroupId: string
  subgroupName: string
  rssUrl: string
  targetServerIds: string[]
  syncByServer: Record<
    string,
    { status: 'ok' | 'pending' | 'error'; lastError?: string; lastPushedAt?: string }
  >
  createdAt: string
  updatedAt: string
}

export interface HelperReplica {
  id: string
  bangumiId: string
  title: string
  bangumiSubjectId?: string
  subgroupId: string
  subgroupName: string
  rssUrl: string
}

export type DesiredStateOp =
  | { type: 'add'; replica: HelperReplica }
  | { type: 'remove'; id: string }

export function desiredStateDiff(
  desired: HelperReplica[],
  current: HelperReplica[],
): DesiredStateOp[]
```

Diff rules: add when `id` missing on helper; remove when `id` present on helper but not in desired; same `id` with different fields counts as remove+add. Order: removes first, then adds. One helper's ops are independent of other servers (function is per-helper).

- [ ] **Step 1: Scaffold package** with `"name": "@torrent-vibe/helper-protocol"`, `"type": "module"`, vitest, `exports: { ".": "./src/index.ts" }`. Workspace already includes `packages/*`.

- [ ] **Step 2: Write failing tests** in `desired-state.test.ts`:
  - empty desired + empty current → `[]`
  - desired has A, current empty → `[{ type: 'add', replica: A }]`
  - desired empty, current has A → `[{ type: 'remove', id: A.id }]`
  - desired A+B, current A → add B only
  - desired A, current A' (same id, different rssUrl) → remove A then add A'
  - two replicas, current has an extra C → remove C, keep A/B

- [ ] **Step 3: Run tests, confirm fail** (`pnpm --filter @torrent-vibe/helper-protocol test`)

- [ ] **Step 4: Implement types + `desiredStateDiff`**

- [ ] **Step 5: Tests pass, commit** `feat(helper-protocol): add subscription types and desired-state diff`

---

### Task 2: packages/mikan parser

**Files:**
- Create: `packages/mikan/package.json` (`@torrent-vibe/mikan`)
- Create: `packages/mikan/tsconfig.json`
- Create: `packages/mikan/vitest.config.ts`
- Create: `packages/mikan/src/index.ts`
- Create: `packages/mikan/src/title.ts`
- Create: `packages/mikan/src/title.test.ts`
- Create: `packages/mikan/src/rss.ts`
- Create: `packages/mikan/src/rss.test.ts`
- Create: `packages/mikan/src/html.ts`
- Create: `packages/mikan/src/html.test.ts`
- Create: `packages/mikan/src/urls.ts`
- Create: `packages/mikan/fixtures/` — small saved HTML/RSS snippets (no network)

**Interfaces:**
- Consumes: nothing
- Produces:

```ts
export function joinMikanUrl(baseUrl: string, path: string): string
export function bangumiRssUrl(baseUrl: string, bangumiId: string, subgroupId: string): string
export function torrentDownloadUrl(baseUrl: string, href: string): string

export interface ParsedTitle {
  title: string
  season: number | null
  episode: number | null
}

export function parseMikanTitle(raw: string): ParsedTitle
// episode/season null → caller marks needs-manual. Never invent S00E00.

export interface RssEpisode {
  episodeId: string
  title: string
  torrentUrl: string
  publishedAt?: string
  sizeBytes?: number
}

export function parseBangumiRss(xml: string, baseUrl: string): RssEpisode[]

export interface BangumiCard {
  bangumiId: string
  title: string
  coverUrl?: string
  weekday?: number // 0=Sun .. 6=Sat if known
}

export interface SeasonWall {
  year: number
  season: string
  groups: Array<{ weekday: number; items: BangumiCard[] }>
}

export function parseSeasonWall(html: string): SeasonWall
export function parseSearchBangumi(html: string): BangumiCard[] // bangumi only, never torrent rows

export interface BangumiDetail {
  bangumiId: string
  title: string
  coverUrl?: string
  bangumiSubjectId?: string
  subgroups: Array<{ id: string; name: string }>
  episodes: Array<{
    episodeId: string
    subgroupId: string
    title: string
    torrentUrl: string
    sizeBytes?: number
    publishedAt?: string
  }>
}

export function parseBangumiDetail(html: string, bangumiId: string, baseUrl: string): BangumiDetail
```

Use fixtures copied from real Mikan markup (trim to the nodes you parse). Tests must not hit the network.

Title cases:
- `[ANi] 葬送的芙莉莲 - 28 [1080P]` → episode 28, season null is OK (default season 1 only at rename time in helper, not here)
- missing episode number → `episode: null`
- `S02E07` / `第07集` if present in fixture

- [ ] **Step 1: Scaffold package + fixtures**
- [ ] **Step 2: Failing title/rss/html tests**
- [ ] **Step 3: Confirm fail**
- [ ] **Step 4: Implement parsers**
- [ ] **Step 5: Tests pass, commit** `feat(mikan): parse titles, RSS, season wall, search, and bangumi detail`

---

### Task 3: Mikan DiscoverProvider + settings + last-provider memory

**Files:**
- Modify: `layer/renderer/src/atoms/settings/discover.ts` — add `mikan` to `DISCOVER_PROVIDER_IDS` and `DiscoverProviderConfigMap`
- Modify: `layer/renderer/src/lib/storage-keys.ts` — add `DISCOVER_LAST_PROVIDER`
- Modify: `layer/renderer/src/modules/discover/providers/index.ts` — register mikan
- Create: `layer/renderer/src/modules/discover/providers/mikan/` (`index.ts`, `search.ts`, `detail.ts`, `download.ts`, `utils.ts`)
- Modify: `layer/renderer/src/modules/modals/SettingsModal/tabs/discover/` — Mikan section (enabled + base URL)
- Modify: `layer/renderer/src/modules/modals/DiscoverModal/` — persist last provider; if remembered id missing/not ready, first ready provider and rewrite memory
- Modify: i18n `locales/app` + `locales/setting` zh-CN/en keys for Mikan
- Add: renderer vitest **or** keep parse tests in `@torrent-vibe/mikan` and add a small `lastProvider.ts` + test next to Discover actions

**Interfaces:**
- Consumes: `@torrent-vibe/mikan` parse functions; existing `DiscoverProviderImplementation`
- Produces: provider id `'mikan'`
- `MikanProviderConfig`: `{ id: 'mikan'; enabled: boolean; displayName: string; baseUrl: string; pageSize: number }`
- Default `baseUrl`: `https://mikanani.me`
- `isConfigReady`: enabled + non-empty baseUrl
- `search`:
  - empty/whitespace keyword → season wall for current year + season (filters `year`, `season`; default now). Map each `BangumiCard` to `DiscoverItem` with `id = bangumiId`, `title`, `extra: { kind: 'bangumi', weekday, coverUrl }`
  - non-empty keyword → `parseSearchBangumi` results as bangumi items (ignore season filter)
- `getItemDetail`: bangumi page → `DiscoverItemDetail` with subgroups/episodes in `extra`
- `getDownloadUrl`: for an episode id, return that episode's torrent URL (detail extra or fetch)
- Last provider memory: read/write `STORAGE_KEYS.DISCOVER_LAST_PROVIDER`. Apply on modal open / `setActiveProviderId`.

M-Team list UI must keep working. Do not build the Mikan wall chrome in this task.

- [ ] **Step 1: Failing tests for last-provider resolve** (`resolveLastProvider(remembered, readyIds)`)
- [ ] **Step 2: Implement resolve helper + persist in DiscoverModalActions**
- [ ] **Step 3: Register mikan provider wrapping `@torrent-vibe/mikan` + settings section**
- [ ] **Step 4: Add `@torrent-vibe/mikan` workspace dep on renderer**
- [ ] **Step 5: typecheck renderer, commit** `feat(discover): add mikan provider and remember last source`

---

### Task 4: Mikan Discover shell (wall, search, bangumi page)

**Files:**
- Create: `layer/renderer/src/modules/modals/DiscoverModal/mikan/` — `MikanDiscoverShell.tsx`, `MikanSeasonWall.tsx`, `MikanBangumiPage.tsx`, `MikanSearchResults.tsx`
- Modify: `DiscoverModal.tsx` — if active provider is `mikan`, render `MikanDiscoverShell` instead of torrent list + preview
- Modify: header — season picker when provider is mikan; search placeholder “搜番名”
- Single-episode import uses existing torrent add pipeline (`getDownloadUrl` + existing import action)
- Remember last subgroup per bangumi in local storage (`DISCOVER_MIKAN_LAST_SUBGROUP`)
- Bulk import, subscribe, 我的订阅 tab: **stubs disabled** with helper-not-bound copy — implemented in Task 7
- No comments. Follow existing modal component style.

**Interfaces:**
- Consumes: mikan provider search/detail/download, DiscoverModal store
- Produces: bangumi-first UI as spec §4.2–4.4 minus helper-backed actions

Wall: group by weekday from `extra.weekday`. Cards show cover + title. Click → full-page bangumi detail (replaces wall). Back returns to wall or search.

Search: typing commits bangumi search; clear returns to selected season wall.

- [ ] **Step 1: Implement shell switch in DiscoverModal**
- [ ] **Step 2: Season wall + search results + bangumi drill-in**
- [ ] **Step 3: Single-episode import wired**
- [ ] **Step 4: Manual sanity (typecheck). Commit** `feat(discover): add mikan bangumi wall and drill-in page`

---

### Task 5: Helper skeleton (discover, pair, desired-state HTTP, Docker)

**Files:**
- Create: `apps/helper/package.json` (`@torrent-vibe/helper`)
- Modify: `pnpm-workspace.yaml` — add `apps/*`
- Create: `apps/helper/src/index.ts` — listen `PORT` default `17890`
- Create: `apps/helper/src/config.ts` — `libraryRoot`, `qbitUrl`, `qbitUser`, `qbitPass`, `token`, `port`
- Create: `apps/helper/src/http.ts`
- Create: `apps/helper/src/mdns.ts` — advertise `_torrentvibe-helper._tcp`
- Create: `apps/helper/src/store.ts` — replica list persistence (json file under `DATA_DIR`)
- Create: `apps/helper/src/http.test.ts`
- Create: `apps/helper/Dockerfile`
- Create: `apps/helper/README.md` — env vars + docker run (user asked no extra docs unless needed; keep README to run the daemon)

**HTTP (JSON, `Authorization: Bearer <token>` except `/discover`):**
- `GET /discover` → `{ version, bindState, advertisedQbitUrl, pairingCode, port }`
- `POST /pair` body `{ code }` → `{ token }` if code matches; else 403
- `GET /subscriptions` → current replicas
- `PUT /subscriptions` body `{ replicas: HelperReplica[] }` → apply `desiredStateDiff`, persist, return `{ replicas }`
- `GET /status` → replicas + episode states (empty episodes until Task 6)

Pairing: helper generates a 6-char pairing code at boot, logs it. `/discover` is unauthenticated. After successful pair, subsequent `/pair` with old code still works until restart (code rotates on process start).

- [ ] **Step 1: Failing HTTP tests** with undici/supertest against the app factory (no real mDNS in unit tests)
- [ ] **Step 2: Implement HTTP + store + desired-state apply**
- [ ] **Step 3: mDNS advertise (skip if `MIKAN_HELPER_DISABLE_MDNS=1`)**
- [ ] **Step 4: Dockerfile + workspace**
- [ ] **Step 5: Tests pass, commit** `feat(helper): add pairable HTTP daemon and desired-state sync`

---

### Task 6: Helper loop (RSS, add, completion, rename)

**Files:**
- Create: `apps/helper/src/loop.ts`
- Create: `apps/helper/src/rename.ts`
- Create: `apps/helper/src/loop.test.ts`
- Create: `apps/helper/src/rename.test.ts`
- Create: `apps/helper/src/qb.ts` — thin wrapper over qBittorrent WebAPI for add / list / rename
- Modify: `apps/helper/src/index.ts` — start loop
- Modify: `apps/helper/src/http.ts` — `POST /backfill` `{ bangumiId, subgroupId, episodes: RssEpisode[] }` for bulk import

**Interfaces:**
- Consumes: `@torrent-vibe/mikan` `parseBangumiRss`, `parseMikanTitle`; `@torrent-vibe/helper-protocol` episode states
- Produces: loop tick function injectable with fake clock, fake RSS, fake qBit

Loop (default 10 minutes):
1. Fetch each replica RSS
2. Parse episodes; skip if episodeId or infohash already in replica episode map or already in qBit
3. Add torrent with category `Bangumi`, save path `{libraryRoot}/{title}/Season {XX}/` (season 1 if title parse has null season **and** episode is non-null; if episode is null, do not add — mark `needs-manual`)
4. Display name `{title} - SxxExx`
5. On qBit completion, rename video + matching subs only; skip Sample/NCOP/NCED
6. Rename via qBit API; failure → `failed`, retry next tick; keep torrent
7. Tag/category so the helper can recognize its own torrents (`Bangumi` + torrent comment or tag `tv-mikan:<subscriptionId>`)

Inject dependencies so tests never hit network.

- [ ] **Step 1: Failing loop/rename tests** (dedupe, skip existing hash, needs-manual, rename skips Sample)
- [ ] **Step 2: Implement loop + rename planner**
- [ ] **Step 3: Tests pass, commit** `feat(helper): poll Mikan RSS, add torrents, rename on complete`

---

### Task 7: Subscriptions store, helper pairing UI, 我的订阅, badges, bulk import

**Files:**
- Create: `layer/renderer/src/modules/subscriptions/` — store, actions, persist (`STORAGE_KEYS.SUBSCRIPTIONS`)
- Create: `layer/renderer/src/modules/helper-client/` — discover probe, mDNS list (Electron IPC if needed), pair, put subscriptions, get status, backfill
- Modify: multi-server / connection settings — helper URL + pair UI (same-host probe `{qbitHost}:17890`, mDNS list, manual URL, confirm code)
- Modify: Mikan shell — subscribe / retarget / unsubscribe; wall badges; 我的订阅 tab; bulk import via helper `/backfill`
- Modify: Electron main IPC if mDNS browse cannot run in renderer
- Disable subscribe + bulk import when current server has no paired helper; single import stays on qBit

**Interfaces:**
- Consumes: Tasks 1–6 APIs
- Produces: spec §4.5–4.6 and §6

On launch / server switch / subscribe / retarget / unsubscribe: `desiredStateDiff` locally then `PUT /subscriptions` for each target helper. Record `syncByServer`. One helper error does not roll back others.

Probe: `GET http://{qbitHostname}:17890/discover`. mDNS optional; if Electron cannot browse, same-host probe + manual URL still ship.

- [ ] **Step 1: Failing tests for subscription store + per-helper desired set**
- [ ] **Step 2: Store + helper client**
- [ ] **Step 3: Settings pair UI + Mikan subscribe / 我的订阅 / badges / backfill**
- [ ] **Step 4: typecheck + tests, commit** `feat(discover): sync mikan subscriptions to paired helpers`

---
