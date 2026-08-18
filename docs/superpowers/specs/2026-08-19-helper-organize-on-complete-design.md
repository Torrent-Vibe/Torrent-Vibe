# Helper organize on complete — Design Spec

2026-08-19 · Status: draft · revised after `e7eef0f`

This spec only *places files* after a torrent finishes. NFO / posters stay a later scrape spec.

`e7eef0f` is the credential path. Do not add a second token pipe.

### What it is

Helper sits on the download host. When a torrent reaches `completed` and identity is good enough, it hard-links video files into `libraryRoot`:

```
{library}/Movies/Title (Year)/Title (Year).mkv
{library}/TV/Show Name/Season 01/Show Name - S01E02.mkv
```

qBittorrent's save path does not move. Seeding stays intact. The desktop app may be closed.

Helper-managed Mikan/Bangumi subscriptions already identify and rename on ingest — those stay `skipped` here. This job is one-off movie / TV / anime that land in the same qBittorrent.

Auto-organize is off by default. Desktop/iOS can still fire `POST /organize` for one hash.

### Decisions

- Where it runs: Helper. Electron/iOS are clients
- Job this round: Place files only. No NFO / poster
- How files land: Hard link. Copy only on `EXDEV`
- qB save path: Untouched
- Credentials: Existing Helper Profile (`GET/PATCH /profile`)
- TMDB: `metadata.tmdb.apiKey` from Profile. Required
- LLM: Not required. Do not block on `ai.openai.apiKey`
- How keys get there: User uploads the `tmdb` group via 凭证同步. Not implicit on pair
- Identity: Title parse + TMDB unique match, then optional Profile LLM fallback (same spirit as desktop `analyzeName`, Helper-go only)
- In scope: one-off `movie` / `tv` / `anime`
- Out: Helper subscription episodes; `music` / `other`; collections
- Gate: Unique or high-confidence TMDB match. Otherwise `needs-manual`
- Auto: `organizeOnComplete` on Helper config, default false
- Manual: `POST /organize` `{ hash }`
- Persist `hash → libraryRelPath` in Helper store
- Folder model: Movies `Title (Year)/`. Series: show dir + `Season NN`
- libraryRoot: existing Helper `PUT /config` field

### Out of scope

- A new token / API-key sync channel
- Pushing keys on pair
- Running desktop torrent-ai / bash tools on Helper
- NFO, posters, fanart
- Moving or renaming files inside the torrent
- Re-organizing Helper-managed episodes
- Multiple library roots
- Auto-on for the existing completed pile on first enable

### Credentials

Read `metadata.tmdb.apiKey` from the existing Profile store. Missing key → `needs-manual` (`missing-tmdb-key`). Do not fall back to Electron's token store. Never echo the key on `GET /config`. `Public()` / UI may show `hasTmdbApiKey`.

### Placement

All new backend code in `apps/helper-go`:

- `internal/tmdb` — reuse / extend the client from identity scrape
- `internal/organize` — `Plan(hash)`, `Apply(hash)`
- `internal/store` — `organized.json` (`hash`, `status`, `libraryRelPath`, `tmdbId`, `at`)
- `internal/httpx` — `GET /organize?hash=`, `POST /organize`
- `PUT /config` — add `organizeOnComplete` (bool, default false)
- Loop tick: after subscription ingest, scan qB for newly completed hashes when `organizeOnComplete` is on

Desktop (required) and iOS (if it fits existing helper UI patterns without a large redesign):

- Settings copy + 「整理」 that `POST /organize`
- No local OrganizeService. No path-mapping requirement (Helper and qB share the host)

### Identity on Helper

Do not ship the Electron agent.

1. Parse torrent name + qB file list for title, year, SxxEyy, kind.
2. TMDB search movie or tv with `metadata.tmdb.apiKey`.
3. Keep a candidate only when name / original_name matches after stripping spaces and punctuation, or one contains the other.
4. If the kept set is size 1, that identity is used.
5. If not, and Profile has `ai.openai.apiKey` or `ai.openrouter.apiKey`, run a thin Helper LLM loop (TMDB tools + `submitMetadata`). Codex is not used (no API key on Profile). Missing LLM key is OK.
6. Apply only when the payload is a unique TMDB fold-match or a high-confidence TMDB id (`confidence >= 0.8`). Otherwise `needs-manual`.
7. Series season rules stay with the identity scrape spec (clear token wins; TMDB only when seasonAmbiguous).

No Electron torrent-ai package, no web search, no agent-browser.

### Plan / Apply

- Helper reads qB `save_path` directly
- `libraryRoot` unset → `needs-manual`
- empty TMDB key → `needs-manual`
- Helper subscription hash → `skipped`
- Video extensions only; skip samples / NCOP / NCED / extras
- Dest exists different inode/size → `needs-manual`
- Dest already our hard link → `already`
- Apply: mkdir under libraryRoot only, link then copy on EXDEV. Never write outside libraryRoot. Never delete a source. Never overwrite a dest that is not already our link.

Sanitize titles for the filesystem. Year omitted if unknown. Specials → Season 00. Missing episode on tv/anime → `needs-manual`.

### Desktop UI

- Helper config: toggle 完成后自动整理 (maps to `organizeOnComplete`), short note that this hard-links into libraryRoot, needs TMDB synced, and may use a synced OpenAI / OpenRouter key for messy names
- Completed one-off torrent: 「整理」 calling `POST /organize`
- Show needs-manual reason; on ok show dest / reveal if you already have path actions
