# Helper Language / Resolution Variant Pick — Design Spec

2026-08-16 · Status: approved

Extends the helper ingest loop in
`2026-08-15-mikan-discover-design.md` and
`2026-08-16-helper-contract-design.md`. Discover chrome, pairing, desired
state, outbound proxy, and file-add of `.torrent` bytes are unchanged.

A 2026-08-16 probe of 12 live Mikan bangumi (783 titles) locked the
lexicon in §6. Classifier bugs found in that probe (`-Raws` group names,
`1920x1080` ranked as 1920, missed `CHT&CHS` / `繁简外挂`, missed
`中日双语`) are written here as the intended rules, not as follow-ups.

## 1. What it is

One Mikan subgroup often publishes the same episode several times:
简体 and 繁体, 简嵌 / 繁嵌 / 简繁内封, 720 and 1080. The helper today
dedupes only on Mikan episode id and infohash, so those rows all add.

This spec adds a title-tag classifier and a pick step **inside Helper
`ingestEpisodes`**, before any qBittorrent add. RSS poll and bulk
backfill share it. The helper still fetches the `.torrent` itself and
POSTs the file. Electron single-episode import does not go through this
path.

It is not a media-library quality gate and not a cross-subgroup picker.

## 2. Decisions

| Topic | Choice |
| --- | --- |
| Where | Helper-only, in `ingestEpisodes`. Same path for RSS and `/backfill`. |
| How | Title-tag classifier. No file inspect, no model. |
| Mutex set | Same `subgroupId` + season + episode. Cross-subgroup never mutexes. |
| Language classes | `internal` (dual pack), `sc`, `tc`. RAW / unlabeled are not a class. |
| RAW / unlabeled | Never enter the mutex. Always eligible to add on their own. |
| Resolution | Keep the highest classified rung. Unknown resolution is not zero. |
| Tie break | Resolution first, then `variantPrefer`. Default `internal,sc,tc`. |
| Already added | First-wins. No upgrade, no delete, no re-add. |
| Losers | New state `skipped` plus `lastError` `skipped-resolution` or `skipped-language`. Not `failed`. |
| Retry | `/retry` still accepts only `failed` and `needs-manual`. |
| Config | Helper `variantPrefer` on disk and `GET/PUT /config`. No v1 UI. |
| Electron | Protocol union gains `skipped`. No skipped copy and no preference UI in v1. |

## 3. Out of scope

- Settings UI for `variantPrefer`
- Skipped / variant labels in Discover or 我的订阅
- Upgrading a torrent that is already `added` / `downloading` / `renaming` / `done`
- Cross-subgroup or cross-bangumi mutex
- ML / fuzzy title matching
- Inspecting downloaded files or subtitle tracks to reclassify
- Changing Electron single-episode import (still the existing add-torrent path)
- Tightening the add-confirmation race (hash listed in qBit before `added`)
- NFO, posters, local media index
- Changing season / episode parse (`ParseMikanTitle` stays as it is)

## 4. Placement

`ParseMikanTitle` still yields season and episode. New pure functions
live next to it in `apps/helper-go/internal/mikan`:

- `ClassifyLanguage(title) → internal | sc | tc | unset`
- `ClassifyResolution(title) → 720 | 1080 | 1440 | 2160 | 4320 | unset`
- `PickVariant(items, prefer) → winner + losers with reason`

`ingestEpisodes` calls them after the existing episode-id / infohash /
present-hash filters and after season/episode resolve. Only the winner
of a mutex group calls `fetchTorrent` + `AddTorrent`. Losers are
appended as `skipped` and never touch qBittorrent.

Unparsed episode numbers stay `needs-manual` and do not enter a group.

Season missing still means season `1`, same as rename.

## 5. Grouping and pick

### 5.1 Group key

```
subgroupId + season + episode
```

`subgroupId` is the replica’s Mikan subgroup, not a string parsed from
the title. Two replicas of the same bangumi do not share a group.

Items with `episode == nil` after parse + Bangumi fallback are not
grouped.

### 5.2 Who enters the mutex

An item enters the mutex only when `ClassifyLanguage` returns
`internal`, `sc`, or `tc`.

These never enter, even when a resolution is present:

- Explicit RAW (see §6.3)
- No language tag at all (黒ネズミたち, GJ.Y, Netflix, 日英双语, …)

A RAW 1080 and a 简体 1080 of the same episode both add. An unlabeled
1080 and a 简体 1080 both add.

### 5.3 Winner

Among mutex members of one group, in one ingest batch:

1. Compare resolution only when **both** sides have a classified rung
   and the rungs differ. Higher rung wins. Reason on the loser:
   `skipped-resolution`.
2. Otherwise (same rung, or either rung unset) compare language by
   `variantPrefer` order. Earlier in the list wins. Reason on the loser:
   `skipped-language`.
3. A remaining total tie keeps the earlier item in the incoming slice.

Unknown resolution is not ranked as `0`. A 简体 with no rung versus a
繁体 1080 is a language comparison, not a 1080 win.

Examples with default `internal,sc,tc`:

| Incoming | Added | Skipped |
| --- | --- | --- |
| `[48][简体]` + `[48][繁体]` | 简体 | 繁体 / `skipped-language` |
| 北宇治 内封 + 简嵌 + 繁嵌 | 内封 | 简嵌、繁嵌 / `skipped-language` |
| same lang `720` + `1080` | 1080 | 720 / `skipped-resolution` |
| 简 720 + 繁 1080 | 繁 1080 | 简 720 / `skipped-resolution` |
| unlabeled + 简体 1080 | both | — |
| `[RAW]` + 简体 | both | — |
| 中日双语 + 繁体, same res | 中日双语 (`sc`) | 繁体 / `skipped-language` |

### 5.4 First-wins against stored state

Per-item episode id, stored infohash, and “hash already in this
qBittorrent” filters run first, unchanged.

Then, if any **stored** row in the same group key is `added`,
`downloading`, `renaming`, or `done`, every new mutex member of that
key is recorded `skipped`. Classify the stored row’s `title` to choose
the reason: `skipped-resolution` when both sides have rungs and the new
rung is higher; otherwise `skipped-language`. The torrent is not
replaced.

`failed`, `needs-manual`, and `skipped` do not block **new** episode
ids of that group. A failed 简体 does not stop a later, never-seen 繁体
1080 from being picked.

A row already stored as `skipped` is not re-opened. Same-batch losers
stay `skipped` even if the winner’s fetch or add then fails. Recover
the failed winner with `/retry`; the skipped siblings stay skipped.

Language-unknown newcomers still add, subject only to the per-item
filters.

### 5.5 Batch versus later RSS

A single backfill or RSS page that contains 720 and 1080 of the same
group picks 1080 immediately. A 720 that already reached `added` is
not replaced when 1080 appears on a later poll.

## 6. Lexicon

Matching is case-insensitive. CJK keys match on the title with spaces
removed. ASCII keys use letter boundaries so they do not fire inside
other tokens.

Order is mandatory: **internal → RAW (unset) → sc → tc**. A title that
is internal is never also sc or tc.

### 6.1 Internal (dual pack)

Any of these substrings:

- `简繁内封` `简繁日内封` `简繁英内封` `简繁日英内封`
- `繁简内封` `繁简外挂` `简繁外挂`

Or both of:

- `简繁` or `繁简`
- `内封` or `外挂`

Or an ASCII pair (optional spaces around the joiner):

- `CHT&CHS` `CHS&CHT` `GB&BIG5` `BIG5&GB`
- the same pairs with `＋` or `+`

If the title contains `简繁` or `繁简` but does **not** meet the
internal rule, do not fall through to `简日` / `繁日`. Leave language
unset. That stops `简繁日` without 内封/外挂 from becoming `sc`.

### 6.2 Simplified / traditional

`sc`, longest CJK first:

`简体内嵌` `简日内嵌` `简体内` `简日内` `简日双语` `中日双语` `日中双语`
`简体` `简日` `简中` `中日`

Then ASCII as whole tokens: `jpsc` `chs` `gb` `sc`.

`tc`, longest CJK first:

`繁体内嵌` `繁日内嵌` `繁体内` `繁日内` `繁日双语`
`繁体` `繁日` `繁中`

Then ASCII as whole tokens: `big5` `cht` `tc`.

`中日` / `中日双语` / `日中双语` / `简日双语` are `sc` because they
carry a Chinese track. `日英双语` has no Chinese track and stays
unset.

### 6.3 RAW — unset, never mutex

Language is unset when the title has an explicit no-subs tag:

- `无字幕`
- `生肉`
- a `[RAW]` / `[raw]` tag

Do **not** treat group names `Skymoon-Raws`, `Lilith-Raws`, `DBD-Raws`,
`Nix-Raws`, or any `X-Raws` token as RAW. Those rows still classify
from their real language tags (`[CHT]`, `[CHT&CHS]`, …).

### 6.4 Resolution rungs

Recognised rungs: `720` `1080` `1440` `2160` `4320`.

Sources, first match wins per source, keep the **max** rung found:

1. Standalone `8K` → 4320, `4K` → 2160.
2. `(\d{3,4})\s*p` mapped through the rung table.
3. `(\d{3,4})\s*x\s*(\d{3,4})` — take the **min** of the two numbers,
   then map. `1920x1080` → 1080, `1280x720` → 720, `3840x2160` → 2160.
   Never keep the raw 1920 / 3840.
4. A bare `720|1080|1440|2160|4320` token if nothing else hit.

Rung table for a raw number `n`:

| `n` | Rung |
| --- | --- |
| 720, 1080, 1440, 2160, 4320 | itself |
| 1280 | 720 |
| 1920 | 1080 |
| 2560 | 1440 |
| 3840 | 2160 |
| 7680 | 4320 |
| 700–800 | 720 |
| 1000–1200 | 1080 |
| 2000–2300 | 2160 |

Anything else (`990`, `640`, `854`, random years) is ignored.

No digit and no `4K`/`8K` → resolution unset.

### 6.5 Probe snapshot (not a runtime input)

12 shows, 783 titles, after the rules above:

| Language | Count |
| --- | --- |
| internal | 277 |
| tc | 197 |
| unknown | 178 |
| sc | 131 |

Resolution collapsed to 720 / 1080 / 2160 / unknown. Remaining unknown
language is mostly unlabeled web-disk groups, `无字幕`, and `日英双语`.

## 7. Config

New helper field `variantPrefer` (string).

- Default / empty / unparsable: `internal,sc,tc`
- Valid: a comma-separated permutation of exactly those three tokens
- Invalid body on `PUT /config` → `400`, no write
- Persisted in `$DATA_DIR/config.json` with the other overlays
- First-boot default only; no extra flag/env in v1
- `Public()` includes the stored string
- Changing it does **not** rewrite existing `added` / `skipped` rows.
  The next ingest of *new* episode ids uses the new order

Electron `HelperConfigPublic` / `HelperConfigPatch` grow the field so
`/config` round-trips. The Helper settings form does not show it in v1.

## 8. Episode state

`HelperEpisodeState` / `protocol.EpisodeState` gains `skipped`.

```
pending | added | downloading | renaming | done | failed | needs-manual | skipped
```

`store.Episode` shape is otherwise unchanged. Losers keep title, season,
episode, empty infohash, and:

| `lastError` | When |
| --- | --- |
| `skipped-resolution` | Lost on rung |
| `skipped-language` | Lost on `variantPrefer` (including first-wins against a committed row of equal or unknown rung) |

`syncCompleted` ignores `skipped` the same way it ignores
`needs-manual` and `done`.

`POST /retry` still rejects anything that is not `failed` or
`needs-manual`.

The renderer union must accept `skipped` so status JSON type-checks.
v1 may keep mapping an unknown / skipped state to the pending label.
Do not invent a retry affordance for skipped rows.

## 9. Error handling

| Case | Behavior |
| --- | --- |
| Language unset | Add independently. Not a failure. |
| Resolution unset | Competes on language only, or adds if language unset. |
| Episode unset | `needs-manual`, no group. |
| Winner fetch/add fails | Winner `failed`. Same-batch losers already written as `skipped` stay skipped. A later poll may still add a **new** episode id of that group, because `failed` does not block (§5.4). The failed row itself is held by episode id until `/retry` deletes it. |
| All members language-unset | Each adds (subject to id/hash filters). |
| `variantPrefer` garbage on disk | Load as default `internal,sc,tc`. Do not refuse boot. |
| `PUT` garbage | `400`. |

## 10. Testing

Pure logic. No live Mikan or qBittorrent.

Classifier tables (real titles from the probe, plus the bug-fix cases):

- 豌豆 `[48][简体][1080P]` → sc, 1080
- 豌豆 `[48][繁体][1080P]` → tc, 1080
- 北宇治 `[简日内嵌]` / `[繁日内嵌]` / `[简繁日内封]` → sc / tc / internal
- 漫猫 `[GB&JP][简日双语]` / `[BIG5&JP][繁日双语]` → sc / tc
- `[CHT&CHS]` and `繁简外挂` → internal
- `沸羊羊…中日双语` → sc
- `日英双语` → unset
- `[无字幕]` → unset
- `Skymoon-Raws` + `[CHT]` → tc, not unset
- `1920x1080` → 1080, not 1920
- `3840x2160` / `4K` → 2160
- `990` → unset resolution
- `-Raws` in the group name must not hide a later `[CHT&CHS]`

Pick tables (the §5.3 examples, plus):

- already `added` 720, later 1080 → 1080 is `skipped-resolution`, no add
- stored `failed` 简体 + new 繁体 1080 (new episode id) → add 繁体
- same-batch 简 + 繁, 简 add fails → 简 `failed`, 繁 stays `skipped`
- two replicas (two subgroup ids), same episode, 简 vs 繁 → both add
- collection title with no episode → `needs-manual`, no pick
- `480p` → resolution unset

`/retry` rejects `skipped`. `PUT /config` accepts a permutation and
rejects `{variantPrefer:"sc"}`.

Existing ingest tests (id/hash dedupe, file add, rename) stay green.

## 11. Implementation order

1. `ClassifyLanguage` / `ClassifyResolution` + lexicon tests.
2. `PickVariant` + group/first-wins tests.
3. Wire into `ingestEpisodes`; losers do not call fetch/add.
4. `skipped` on the Go + TS protocol unions; `/retry` guard.
5. `variantPrefer` on config file, `Public()`, `GET/PUT /config`.
6. Renderer types only (no form, no i18n requirement in v1).
