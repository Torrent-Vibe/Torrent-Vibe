# Helper Identity Scrape — Design Spec

2026-08-17 · Status: drafted for review

Extends helper ingest in
`2026-08-15-mikan-discover-design.md`,
`2026-08-16-helper-contract-design.md`, and
`2026-08-16-helper-variant-pick-design.md`.

This is the identity layer only: series name, season, episode, and
kind, so save path and rename land in one show folder. NFO, posters,
and a full media-library scrape are a later spec.

The 2026-08-16 live add of 《擅长逃跑的殿下 第二季》E17 wrote
`Season 01` / `S01E17` because `第二季` and a bare `S02` were not
season tokens, and a replica-less backfill rename used the bangumi id
as the title. Those bugs are closed here.

## 1. What it is

Mikan already splits cours into separate bangumi rows (`… 第二季`).
The helper today treats each replica title as the folder name and
defaults missing season to `1`. Two seasons of the same show never
share a folder, and a title that *does* carry a season token is often
ignored.

This spec adds `Identify` inside Helper `ingestEpisodes`, before
variant pick and add. RSS and `/backfill` share it. The helper still
fetches the `.torrent` and POSTs the file.

It is not TMDB artwork, not Jellyfin NFO, and not a rewrite of already
added torrents.

## 2. Decisions

| Topic | Choice |
| --- | --- |
| Job this round | Identity only: series + season + episode + kind |
| Folder model | One series directory. Season number is a `Season NN` child |
| Series name | Strip season tokens from the **subscription** title |
| Clear season tokens | Title wins (`第N季`, `S02`, `Season N`, …) |
| Ambiguous tokens | `第N部分` / `后篇` / `续篇` / trailing `Ⅱ` → TMDB `season_number` only |
| Episode number | The number in the torrent title is the in-season episode |
| Bangumi | Still only fills `episode == nil` when a subject id exists |
| Specials | Tagged `SP` / `OVA` / `OAD` / `总集篇` → `Season 00` |
| NCOP / NCED / Sample | Still skipped at rename, not an Identity kind |
| Collections | `needs-manual`, no add |
| Conflict | Clear token beats ambiguous. Title beats TMDB. TMDB never renames the series |
| Already stored | `added` / `downloading` / `renaming` / `done` are not re-identified |
| Where | Helper-only, before variant pick |

## 3. Out of scope

- NFO, posters, fanart, tvshow.nfo
- Using TMDB as the series-name authority
- Always querying TMDB
- Pushing Electron’s TMDB key to the helper in v1
- Moving or renaming torrents that are already committed
- Cross-subgroup mutex
- Electron single-episode import
- Absolute episode numbers (title `25` becomes `S03E01`)
- Treating `第2部分` as season+1 without TMDB

## 4. Placement

New and changed pieces in `apps/helper-go`:

- `mikan.Identify(subscriptionTitle, torrentTitle) Identity` — pure, no I/O
- `internal/tmdb` — search TV + read seasons; only when Identity says
  `SeasonAmbiguous`
- `bangumi.Resolve` — unchanged contract
- `ingestEpisodes` — Identify → optional TMDB → optional Bangumi →
  existing variant pick → add
- `store.Episode` — persist `series` and `kind` so later rename does
  not re-identify
- `config` — `tmdbApiKey`; `Public()` exposes `hasTmdbApiKey` only

`ParseMikanTitle` stays the episode/SxxEyy extractor and is called from
`Identify`. Variant pick (`2026-08-16-helper-variant-pick-design.md`)
is unchanged except its group key uses the **identified** season.

## 5. Identity

```
series            string
season            *int
episode           *int
kind              episode | special | collection
seasonAmbiguous   bool
```

### 5.1 Inputs

- Subscription / replica title is the series source. Replica-less
  backfill uses the torrent title instead. Never use the bangumi id as
  a display title.
- Torrent title supplies episode, kind, and extra season tokens.

### 5.2 Clear season tokens

Any of these set `season` and do **not** set `seasonAmbiguous`:

- `第N季` / `第N期` with `N` in `1`–`20` or 中文 `一`…`二十`（含 `十三`）
- `Season N`
- `S` + 1–2 digits even without a following `E`（`S02`, `S2`）。不匹配 `SC` / `SP`
- `Nnd Season` / `Nth Season` (`2nd`, `3rd`, `4th`, …)
- `SxxEyy` (also fills `episode`)

Subscription title wins over torrent title when both have a clear
season.

### 5.3 Ambiguous season tokens

These set `seasonAmbiguous` only when **no** clear token exists:

- `第N部分` / `第N部`
- `前篇` / `后篇` / `续篇` / `完结篇`
- A roman `II` / `III` / `IV` (any width) that is not part of
  `第…季` / `Season`
- A roman numeral stuck to the end of the series name (`无职转生Ⅱ`)

If a title has both `第二季` and `第2部分`, use season `2` and clear
`seasonAmbiguous`.

`第N部分` / 前后篇 are not a season increment.

### 5.4 Series name

Delete every token in §5.2 and §5.3 from the subscription title, then
collapse whitespace. If the result is empty, keep the original
subscription title.

Torrent title never overwrites `series` when a replica exists.

### 5.5 Episode

Same rules as today’s `ParseMikanTitle`. That integer is the in-season
episode. Bangumi does not rewrite it.

### 5.6 Kind

| Hit | Kind | Season |
| --- | --- | --- |
| Standalone tag `SP` / `OVA` / `OAD` / `总集篇` | `special` | `0` |
| Range collection (`[01-28 合集]`) or no single episode | `collection` | n/a |
| Otherwise, single episode present | `episode` | from §5.2–5.3 |

`OVA` inside a group name (`OVA工作室`) is not a special. NCOP / NCED /
Sample stay rename-skip rules, not kinds.

## 6. TMDB

Call TMDB only when all of these hold:

- `kind == episode`
- `seasonAmbiguous`
- `season == nil`
- `tmdbApiKey` non-empty
- `series` non-empty

`GET /3/search/tv?query={series}&language=zh-CN`. Do not put
`第2部分` in the query.

Keep candidates whose `name` or `original_name` equals `series` after
stripping spaces and punctuation, or where one contains the other.
If the kept set is not size 1, stop. Do not use TMDB.

On a unique TV id, `GET /3/tv/{id}` and read `seasons` (ignore season
`0` except when matching specials, which this path never does):

| Token | Season pick |
| --- | --- |
| `第N部分` / `第N部` | `season_number == N`, or season name contains `Part N` / `第N` |
| `后篇` / `续篇` / `完结篇` | largest `season_number > 0` |
| `前篇` | smallest `season_number > 0` |
| trailing roman | `season_number` equal to that roman |

If that pick is missing or not unique, stop.

On any stop, timeout, or 4xx/5xx: leave `season` nil. Ingest will
default it to `1`. Do not mark the episode `failed` or
`needs-manual`. Log at debug.

TMDB never writes `series`. `Public()` never returns the API key,
only `hasTmdbApiKey`. `PUT` of `""` clears the key. Electron does not
push its key in v1.

## 7. Ingest

For each new RSS / backfill item, after id/hash filters:

1. `Identify`.
2. `kind == collection` or `episode == nil` after Bangumi →
   `needs-manual`, no add.
3. Ambiguous season → TMDB as in §6.
4. `special` → season `0`. Still-nil season → `1`.
5. Variant pick on `subgroupId + identified season + episode`.
   Specials mutex only against other S00 rows of the same episode
   number. Different seasons never mutex.
6. Winner only: fetch + add.

```
savePath = {libraryRoot}/{series}/Season {XX}/
rename    = {series} - SxxExx
```

`XX` is two digits, including `00`.

`syncCompleted` renames files with the **stored** `series` / season /
episode. It does not call `Identify` again.

Rows already `added`, `downloading`, `renaming`, or `done` are not
re-identified and are not `setLocation`’d. A later item that
identifies as a **different** season is a new group, not an upgrade.

Legacy rows with empty `series` keep today’s rename
(`replica.Title - SxxExx`) so old completes do not flip to the new
scheme.

Replica-less backfill: `series` comes from the torrent title after
strip. An empty-episode backfill that only triggers rename must use
the stored `series`, never the bangumi id.

Variant skip reasons and `/retry` rules are unchanged.

## 8. Error handling

| Case | Behavior |
| --- | --- |
| No season token | Season `1`, series = stripped (or original) title |
| Ambiguous, no key / TMDB fail / not unique | Season `1`, still add |
| Clear token present | Never call TMDB |
| Collection or no episode | `needs-manual` |
| Special | `Season 00`, add if episode known |
| TMDB 4xx/timeout | Not `failed` |
| Fetch / qBit add fail | `failed` as today |
| Old `done` row | Untouched |

## 9. Testing

Pure logic. No live TMDB, Mikan, or qBittorrent.

Identify:

- 订阅 `擅长逃跑的殿下 第二季` + ANi `S02 / … 第二季 - 17` → series
  `擅长逃跑的殿下`, season 2, ep 17, episode
- Same subscription, torrent without `S02` → still season 2
- `无职转生Ⅱ 第2部分` → series `无职转生`, `seasonAmbiguous`
- `第二季` + `第2部分` → season 2, not ambiguous
- `[SP]` / `OVA` / `总集篇` → special, season 0
- `[01-28 合集]` → collection
- `S02E07` → season 2, ep 7
- `第3期` / `3rd Season` / `第十三季` → 3 / 3 / 13
- `OVA工作室` in the group name is not special

TMDB (fake HTTP):

- Unique TV + season 2 exists → `第2部分` becomes 2
- Two name matches → season defaults to 1, still add
- Missing key or timeout → season 1, not failed
- Clear S02 present → zero HTTP calls

Ingest:

- Winner path
  `{root}/擅长逃跑的殿下/Season 02/擅长逃跑的殿下 - S02E17`
- Special → `Season 00`
- Stored `added` S01 does not block a newly identified S02
- Same identified season, higher res → `skipped-resolution`
- Replica-less backfill strips series from the torrent title
- Empty-episode backfill rename uses stored `series`

Config: `PUT tmdbApiKey` persists; `Public` has `hasTmdbApiKey` only;
`""` clears.

Existing variant-pick and ingest tests stay green.

## 10. Implementation order

1. `Identify` + lexicon tests.
2. Persist `series` / `kind`; ingest uses them for path and rename.
3. Fake-HTTP TMDB client + ambiguous-season hook.
4. `tmdbApiKey` on config / `Public` / `PUT`.
5. Replica-less backfill title fix (no bangumi-id display name).
