# Mikan Discover + Host Helper — Design Spec

2026-08-15 · Status: drafted for review

## 1. What it is

Torrent-Vibe stays a remote qBittorrent client. This spec adds a bangumi-first **Mikan** surface inside Electron Discover, plus a **helper daemon on each download host** that follows subscribed shows, adds episodes to the local qBittorrent, and renames files after they finish.

M-Team Discover stays as it is (keyword → torrent list → preview → import). Switching providers uses a Dropdown and remembers the last choice.

iOS is out of this spec. The helper HTTP contract must not block a later iOS client.

## 2. Decisions

| Topic | Choice |
| --- | --- |
| Product | Discover provider + subscription engine, not a media library |
| Mikan UI | Specialized bangumi shell inside the existing Discover modal |
| Landing | Current-season poster wall, grouped by weekday, year/season picker |
| Search | Bangumi only. Empty query = selected season wall. Non-empty = site-wide bangumi search |
| Bangumi page | Full-page drill-in (replaces the wall) |
| Import | One episode, or all released for the current subgroup |
| Subscribe | Persist in Torrent-Vibe; execute on selected helpers |
| Executor | Helper daemon replaces qBittorrent RSS |
| Helper placement | One sidecar per qBittorrent server |
| Pairing | Same-host probe + mDNS, then persist; manual URL fallback |
| Rename | Set save path and display name on add; rename files on completion via qBittorrent API |
| Scrape | Parse Mikan titles; fall back to Bangumi.tv for title/season. No NFO/posters |
| Cross-server | One global subscription list; each row has target server ids |
| Source of truth | Torrent-Vibe subscriptions. Helpers hold execution replicas |
| Mikan auth | None in v1. Configurable base URL / mirror only |

## 3. Out of scope

- iOS app
- NFO, posters, fanart, or a local media index
- Renaming torrents that are not from a helper add / subscription
- Electron polling Mikan, or any daemon on the laptop
- A general qBittorrent RSS manager
- Reading back user-created qBittorrent RSS feeds/rules
- Helper-to-helper sync
- Mikan account / MyBangumi token
- Using the helper as the only client entry (Electron still talks to qBittorrent WebAPI directly)

## 4. User-facing surfaces

### 4.1 Discover chrome

- Entry stays the existing Discover button.
- Header: title, **provider Dropdown**, search field, Mikan-only season picker, current-server helper status, close.
- Dropdown lists registered providers. Current provider is marked. Unconfigured providers are disabled and open Settings, not an empty shell.
- Last provider id is stored locally. Next Discover open restores it. If that provider is disabled or not ready, fall back to the first ready provider and rewrite the memory.
- Switching provider swaps the entire interior: Mikan bangumi shell vs M-Team torrent list.

### 4.2 Mikan tabs

Two tabs: **当季** and **我的订阅** (count = global subscription rows).

Search is bangumi-only. Typing leaves the season wall and shows matching bangumi posters from the whole Mikan catalog. Clearing the query returns to the selected season wall. The season picker stays visible but does not scope a non-empty search.

### 4.3 Season wall

- Empty query + selected year/season → poster grid grouped by weekday.
- Card: cover, title, air weekday, optional “updated today”, subscription badge listing target server names (not a generic “追”).
- Click replaces the interior with the bangumi page.

### 4.4 Bangumi page

- Back returns to the wall or search that led here.
- Cover, title, season, Bangumi.tv rating when known.
- Subgroup chips. Last selected subgroup per bangumi is remembered.
- Episode rows for the current subgroup: title, size, time, helper/qBit state when known.
- Row action: import this episode.
- Page actions: import all released for this subgroup; subscribe / edit targets / unsubscribe.
- Without a paired helper on the current server: subscribe and bulk import are disabled with a bind prompt. Single-episode import still goes to the current qBittorrent.

### 4.5 我的订阅

Global list (not per-server): cover, bangumi + subgroup, target servers and sync state, latest episode, last rename result. Actions: edit targets, unsubscribe, open the same bangumi page. A row with no reachable helper stays listed and offers “绑定 Helper”.

### 4.6 Server settings

Each existing qBittorrent server gains an optional helper:

1. Probe `{qbitHost}:{helperPort}` (default `17890`).
2. Browse mDNS `_torrentvibe-helper._tcp`.
3. Manual URL.

Discovery never auto-binds. User confirms (short code from helper logs / status page). URL + token are stored on that server profile. Later sessions use the stored endpoint; probe/mDNS are for onboarding and “rebind”.

Mikan settings: enabled flag, display name, base URL (mirror). No API key.

## 5. Architecture

```
Electron renderer
  Discover UI ── DiscoverProvider (mikan | mteam)
  Subscriptions store (source of truth)
       │ push desired set / pull status
       ▼
Helper (on each download host)     qBittorrent WebAPI
  replica + loop ──────── add / rename / completion
  mDNS + /discover + /pair
```

Four units:

| Unit | Does | Consumers | Depends on |
| --- | --- | --- | --- |
| Discover UI | Provider dropdown, Mikan shell, M-Team list | User | Providers, subscriptions, server/helper pairing |
| Mikan provider | Season wall, search, bangumi detail, torrent URL | Discover UI | Mikan HTTP (configurable base URL) |
| Subscriptions | Global list, target servers, desired-state diff | Discover UI | Helper HTTP |
| Helper | Replica, RSS poll, add, rename, discover/pair | Electron (later iOS) | Local qBittorrent, Mikan RSS, Bangumi.tv |

Helper is a Node/TypeScript service in this repo (`apps/helper`, package `@torrent-vibe/helper`). Shared request/response types live in `packages/helper-protocol`. Ship a Docker image for NAS. Electron still uses the existing qBittorrent client for the torrent list and for single-episode import.

## 6. Data

### 6.1 Subscription (Torrent-Vibe)

- `id`
- `providerId`: `'mikan'`
- `bangumiId`, `title`, `coverUrl`, `bangumiSubjectId?`
- `subgroupId`, `subgroupName`
- `rssUrl` (Mikan bangumi+subgroup feed, resolved with the configured base URL)
- `targetServerIds: string[]`
- `syncByServer: Record<serverId, { status, lastError?, lastPushedAt? }>`
- `createdAt`, `updatedAt`

Stored with other app settings (same persistence style as discover provider config). Not stored inside qBittorrent.

### 6.2 Helper replica

Copy of the fields needed to run: bangumi/subgroup/rss/title/subject, plus per-episode:

- `episodeId` (Mikan)
- `infohash?`
- `title`, `season`, `episode`
- `state`: `pending | added | downloading | renaming | done | failed | needs-manual`
- `lastError?`

### 6.3 Desired-state push

On app launch, server switch, subscribe, retarget, or unsubscribe, Electron computes the desired subscription set **for that helper** and PUT/PATCHes it. Extra replica rows are deleted; missing rows are created; unchanged rows are left alone. Torrent-Vibe does not merge edits made on the helper. The helper has no subscription UI.

One bangumi+subgroup may target several servers. Removing one target only deletes the replica on that helper.

## 7. Helper loop

Default poll interval: 10 minutes, configurable on the helper.

1. **Poll** each replica’s Mikan RSS.
2. **Dedupe** on Mikan episode id and infohash. Skip if already added, renaming, or done. Skip if the same infohash is already in this qBittorrent (manual import).
3. **Add** via local qBittorrent: Mikan `.torrent` URL, category/tag default `Bangumi`, save path `{libraryRoot}/{title}/Season {XX}/`, display name `{title} - SxxExx`. `libraryRoot`, category, and the helper’s own qBittorrent URL are helper config (env / file, editable from Electron after pairing). The helper’s qBittorrent URL is often `http://127.0.0.1:8080` or a compose service name and is **not** copied from Electron’s server URL.
4. **Watch completion** through qBittorrent WebAPI (not a disk walk).
5. **Rename** video + matching subtitle tracks to `{title} - SxxExx.ext`. Leave Sample, NCOP, NCED, and other extras. Use the qBittorrent rename API so the torrent can keep seeding. On failure, keep the torrent, mark the episode failed, retry next loop.
6. **Parse** season/episode from the Mikan title first. If parse fails, resolve via Bangumi.tv using the cached subject id. If still unknown, do not rename; mark `needs-manual` so nothing becomes `S00E00`.

Electron closed: the loop keeps running on the host. Electron only pushes desired state and reads status for badges / 我的订阅.

Bulk “导入该组已出” is a helper RPC: add every known released episode for that bangumi+subgroup with the same naming context. It does not create a subscription. Dedup rules are the same as RSS.

Single-episode import does not go through the helper. It uses the existing add-torrent path. Those files are not auto-renamed unless the same episode later belongs to a helper job.

## 8. Pairing and discovery

- Helper listens on `17890` by default.
- `GET /discover` returns version, bind state, advertised local qBittorrent URL, and a short pairing code.
- mDNS type: `_torrentvibe-helper._tcp`.
- Pairing: confirm code, then store helper base URL + bearer token on the qBittorrent server profile.
- Wrong code or expired token: clear that server’s helper binding. Do not bind the next advertised instance.
- Unreachable helper: show “未同步” / “未发现 Helper”. Replicas on the host keep executing. Reconnect replays the desired set. A push failure is recorded per server.

Docker must publish the helper port to the host, same as the qBittorrent WebUI. Tailscale / other L3: manual URL.

## 9. Error handling

| Failure | Behavior |
| --- | --- |
| No probe, no mDNS | Settings stay on manual URL; Discover shows helper missing |
| Mikan wall/search/detail error | Error state on that screen, retry; do not wipe last good wall |
| Dead torrent URL | Fail that row only |
| Unreachable Mikan base URL | Prompt to switch mirror |
| qBittorrent add fails (dup, disk, reject) | Mark episode failed, skip next RSS hits, keep subscription |
| Rename fails | Keep torrent, retry later |
| Unparseable title | `needs-manual`, no rename |
| Provider remembered but not ready | First ready provider, rewrite memory |
| One helper push fails | Other targets unchanged |

## 10. Testing

Pure logic, no live Mikan or qBittorrent.

- **Mikan provider fixtures** (saved HTML/RSS): weekday grouping, search returns bangumi only, detail splits subgroups/episodes, download URL shape, title parse success and `needs-manual`.
- **Desired-state diff**: add/remove/retarget; one helper error does not change the other helper’s expected set.
- **Helper loop**: new RSS item adds; episode id / infohash dedupe; skip in-progress and already-present hashes; bulk import skips those too; rename video+subs only; failed rename retries; unparsed titles do not rename.
- **Provider memory**: restore last id; fall back and rewrite when last id is disabled.

Electron chrome, mDNS, and pairing are a manual pass (dropdown, wall → drill-in → subscribe → retarget, confirm pairing code). No CI that needs a LAN.

## 11. Implementation order

1. Shared helper protocol types + in-memory desired-state diff.
2. Mikan provider (wall, search, detail, download) behind the existing DiscoverProvider interface.
3. Discover chrome: dropdown + last-provider memory; swap Mikan shell vs M-Team list.
4. Mikan shell: wall, search, bangumi page (single import only).
5. Helper skeleton: discover, pair, desired-state HTTP, Docker.
6. Helper loop: RSS, add, completion, rename.
7. Subscriptions store + push + 我的订阅 + badges + bulk import + retarget.

## 12. Success

- Opening Discover on Mikan shows this season’s posters without typing.
- Searching a finished show still returns bangumi posters.
- Subscribe on a paired helper continues to add and rename after Electron quits.
- The same show can run on NAS-A and not NAS-B.
- M-Team Discover is unchanged except for the provider Dropdown.
- No qBittorrent RSS feed or rule is created.
