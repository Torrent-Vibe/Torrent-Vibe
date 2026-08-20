# Mikan Subscription UX Rework — Design Spec

2026-08-20 · Status: approved

Extends `2026-08-15-mikan-discover-design.md`,
`2026-08-16-helper-contract-design.md` and
`2026-08-17-mikan-unsubscribe-keep-files-design.md`.

Subscribing stays a per (bangumi × subgroup) commitment executed by a
paired Helper. This spec changes what subscribing *means* to the user,
what the UI shows once subscribed, and gives the Helper an observable
trail so "nothing happened" becomes answerable.

## 1. Problem

Subscribing today produces a success toast and then nothing observable
for up to ten minutes.

| # | Defect | Where |
| --- | --- | --- |
| 1 | Two overlapping actions sit side by side: "导入已出" and "持续订阅" | `MikanBangumiHeaderActions.tsx:76-99` |
| 2 | `PUT /subscriptions` only persists; no tick is triggered | `httpx/server.go:150` |
| 3 | Helper status is fetched once on mount, never polled | `MikanBody.tsx:56` |
| 4 | Per-episode state renders as grey text between size and date | `MikanEpisodeList.tsx:57` |
| 5 | The subscriptions list is reachable only from the browse-page bell | `MikanChrome.tsx:26` |
| 6 | Source of truth is split: desktop trusts localStorage, iOS trusts the Helper | `subscriptions/persist.ts` vs `AppModel.swift` |
| 7 | Subscribe button is silently disabled when no Helper is paired | `MikanBangumiHeaderActions.tsx:94` |
| 8 | RSS fetch failures are swallowed without a trace | `loop/loop.go:105` |
| 9 | The Helper has no log worth reading | `cmd/torrent-vibe-helper/main.go:163-165` |

Defects 7 and 8 are the two literal causes of "I clicked subscribe and
nothing happened": either the click never fired, or the Helper failed to
fetch RSS and told nobody.

## 2. Decisions

| Topic | Choice |
| --- | --- |
| Subscribe semantics | Whole season. Subscribing pulls what already exists **and** follows new releases |
| "导入已出" button | Removed. Folded into subscribe |
| Post-subscribe view | Stay on the detail page; it switches to a subscribed state |
| Source of truth | Helper `GET /status`. localStorage demoted to an offline cache |
| Immediate effect | Optimistic state, then `POST /backfill` per target, then real status |
| Poll cadence | 5s while episodes are active, 30s when settled, stopped when hidden |
| Episode progress | Client-side join on infohash against qBittorrent. No Helper change |
| Check liveness | Per-replica `checkedAt` / `checkError` surfaced in `/status` |
| Observability | Structured event stream **and** raw process log, both behind auth |
| Realtime | Polling. No SSE or WebSocket |
| Platforms | Desktop and iOS aligned in one spec |
| Delivery | One spec, phased implementation (Helper → desktop → iOS) |

## 3. Information architecture

The detail page has two states, selected by whether the *currently
selected subgroup* is subscribed. Subscription state is currently
expressed in three disconnected places — the header button label, a bare
"取消订阅" ghost button mid-page (`MikanBangumiPage.tsx:104-118`), and grey
text in episode rows. These collapse into one subscription bar.

### 3.1 Unsubscribed state

```
←  魔法少女小圆                              [订阅]
──────────────────────────────────────────────────
[封面]  魔法少女小圆
        周四 · Bangumi
        ( 千千字幕组 )( 桜都字幕组 )( 喵萌奶茶屋 )

        ⓘ 你已订阅这部番的「桜都字幕组」  [切过去]
──────────────────────────────────────────────────
E12  1.2 GB · 2026-08-18              [只下这集]
E11  1.2 GB · 2026-08-11              [只下这集]
```

One primary action. The ⓘ row appears only when another subgroup of the
same bangumi is already subscribed — it prevents double-subscribing a
show into two full-season downloads, which nothing guards against today.
It is a passive hint, not a blocking confirm.

### 3.2 Subscribed state

```
←  魔法少女小圆                        [管理订阅 ▾]
──────────────────────────────────────────────────
[封面]  魔法少女小圆
        周四 · Bangumi
        (•千千字幕组)( 桜都字幕组 )( 喵萌奶茶屋 )

        ● NAS · 8/12 就绪 · 1 失败 · 2 分钟前检查
──────────────────────────────────────────────────
E12  ✓ 已完成    1.2 GB
E11  ↓ 63%       1.2 GB
E10  ○ 排队中    1.2 GB
E09  ✗ 失败 · 种子获取超时              [重试]
E08  – 已跳过 · 已有简体版            [仍要下载]
```

- Subscribed subgroups carry a dot on their chip, so switching chips does
  not require guessing.
- The subscription bar answers four questions in one line: **where**,
  **how far**, **anything broken**, **still alive**. The last one —
  "2 分钟前检查" — is what defuses the "did my click do anything" anxiety.
- `[管理订阅 ▾]` contains: 编辑目标服务器 / 立即检查 / 取消订阅. Unsubscribe
  moves off the page body into this menu.
- Per-row `[只下这集]` disappears in the subscribed state (the whole
  season is already committed) but remains as a remedy on `skipped` and
  `needs-manual` rows.

### 3.3 Entries

The bell moves from browse-only to **persistent in the detail header**,
so the subscriptions list is reachable from any screen. Its badge count
stays neutral normally and **turns to a warning color when any
subscription has failed or needs-manual episodes**, so trouble surfaces
without the user going looking for it.

## 4. Data flow

### 4.1 Source of truth

```
Helper GET /status  ──authoritative──┐
localStorage        ──cache─────────┼─→ subscriptionFor(bangumiId, subgroupId)
optimistic (in-flight) ──transient──┘
```

A derived selector merges the three. Precedence for *whether a
subscription exists*: an in-flight optimistic write wins until it
resolves, then the Helper snapshot, then the cache. Precedence for
*episode state* is the reverse in one respect — real Helper state always
beats the optimistic placeholder (§4.2). When the Helper is unreachable
the cached copy renders with an "离线 · 上次同步 x" marker rather than the
UI claiming nothing is subscribed. iOS currently has no cache layer and
renders an empty list when offline; it gains one.

### 4.2 Subscribe orchestration

```
confirm targets
  ├─ optimistic write → UI switches to subscribed, rows show 排队中
  ├─ PUT  /subscriptions   per target
  ├─ POST /backfill        per target, fed with the detail page's extra.episodes
  ├─ GET  /status          real state replaces the optimistic one
  └─ start polling
failure → roll back the optimistic state, bar turns red "同步失败 · 重试"
```

The optimistic layer **only fills rows that have no real state yet**;
rows with real state always render the truth. This avoids the
"排队中 → skipped" flicker.

`actions.ts` `backfill()` currently targets only
`resolveCurrentServerId()`, so multi-target subscriptions never
immediately import on the other servers. It must fan out over every
target.

The detail page's scraped episode list is more complete than the RSS
feed, which is why backfill is fed from it rather than waiting for a
tick.

### 4.3 Polling

| Condition | Interval |
| --- | --- |
| Any episode in pending / added / downloading / renaming | 5s |
| All episodes settled (done / skipped / failed / needs-manual) | 30s |
| Discover closed or window blurred | stopped |

Single-flight with abort; a slow response must not stack.

### 4.4 Matching rules

**Which server's state an episode row shows.** `episodeStateFor` scans
every server snapshot and takes the first hit, so with two targets a row
reads "已完成" while the second server is still downloading. It must
consider only the subscription's own targets and, on disagreement, show
**the least advanced** state.

**The `8/12` in the bar.** Denominator is `replica.episodes.length` (what
the Helper knows about), numerator is `done`; failures are
`failed + needs-manual`. Using the detail page's episode count as the
denominator would keep the ratio permanently short whenever the page is
fresher than the Helper, which reads as stuck.

**Progress percentages** come from joining `HelperEpisodeStatus.infohash`
against the qBittorrent torrent list the client already polls. The
Helper is not involved. This also enables jumping from an episode row to
its torrent in the main window.

```
episode row = Helper semantic state (排队/下载中/改名中/完成/失败/跳过)
            + qB live numbers (63% · 4.2 MB/s)   ← joined on infohash
```

## 5. Helper changes

### 5.1 Per-replica check state

```go
if raw, err := deps.FetchRSS(replica.RSSURL); err == nil {
    incoming = mikan.ParseBangumiRSS(...)
}   // err != nil → silent no-op
```
`loop/loop.go:105`

A proxy requirement, rate limiting or a dead RSS URL all present as
"subscribed but nothing downloads". `loop.Deps` gains
`OnReplicaChecked(replicaID, at, err)`; the result is persisted in a
replica-state record next to the episode store and surfaced per replica
in `/status`:

```
● NAS · 8/12 就绪 · 2 分钟前检查          ← healthy
● NAS · RSS 抓取失败 · 连续 4 次  [详情]   ← the truth
```

### 5.2 Kick a tick after writes

`PUT /subscriptions` schedules `go loop.Tick(deps)`. `Tick` already
serializes on `workMu`, so this is safe without restructuring the loop.
This is the fallback path for flows that have no episode list to backfill
from, such as retargeting from the subscriptions list.

### 5.3 `POST /check`

Backs the "立即检查" menu item. Returns 202 and shares the kick path with
5.2. The bar spins until a later `/status` returns a newer `checkedAt`.

The endpoint triggers a **full tick** across all replicas; it takes no
per-replica filter. A tick already walks every replica, and a filtered
variant would need the loop restructured for no user-visible gain.

### 5.4 Explicitly not added: progress

`store.Episode` gains no progress field. See 4.4 — the clients join
against qBittorrent themselves, more cheaply and more live than a Helper
relay would be.

### 5.5 Compatibility

New fields and endpoints only. An older Helper omits `checkedAt`, and the
bar shows "检查时间未知" instead of breaking. `/discover`'s existing
`capabilities` array gates the "立即检查" and log entries.

## 6. Observability

Two layers answering two different questions.

### 6.1 Structured events — "why didn't this show download"

```go
type Event struct {
    Seq        uint64          // monotonic; the client's incremental cursor
    At         time.Time
    Level      string          // debug | info | warn | error
    Kind       string
    ReplicaID  string          // optional → "only this show"
    BangumiID  string
    SubgroupID string
    EpisodeID  string
    Message    string          // one human-readable sentence
    Fields     map[string]any  // whitelisted keys only
}
```

| Kind | Key fields | Answers |
| --- | --- | --- |
| `tick.start` / `tick.done` | replicaCount, addedCount, durationMs | Is it running at all |
| `rss.fetch` | url, httpStatus, itemCount, durationMs, error | Did RSS even arrive |
| `episode.skip` | reason (language / resolution), rival | Why was this episode skipped |
| `episode.manual` | reason (no-episode-number / collection) | Why does it need a human |
| `torrent.fetch` / `qb.add` | url / hash, savePath, category, tags, error | Torrent fetch or add |
| `qb.rename` | from, to, error | Did renaming land |
| `subscription.put` / `subscription.check` | added, removed | What a client just did |
| `config.change` | keys (**names only, never values**) | Who broke the config |

`episode.skip` reasoning is currently unrecoverable — only the verdict
survives, in `episode.LastError`.

Storage is an in-memory ring buffer (2000 entries) plus rolling JSONL on
disk (`events-YYYYMMDD.jsonl`, 7 day retention). Memory answers "what
just happened"; disk answers "why didn't it download last night".

`GET /events?since=<seq>&level=&replicaId=&kind=&limit=` returns
`{events, cursor}`. Clients poll incrementally every 2s. No SSE or
WebSocket: the Helper has no long-lived connection infrastructure and a
log panel does not justify introducing one.

### 6.2 Raw log — "did it even start"

At startup `os.Stdout` / `os.Stderr` are wrapped through an
`io.MultiWriter` into `<dataDir>/logs/helper.log` (5MB × 3 rolling). The
process owns this rather than `StandardOutput=` in the systemd unit,
because macOS runs detached with no journald and init-level redirection
would diverge per platform.

`GET /logs?tail=500` returns plain text.

Known limitation: if the process cannot start, the API cannot serve its
log. The UI therefore always displays the log file path, copyable.

### 6.3 Redaction

Both endpoints sit behind the existing `rt.authed` middleware. On top of
that:

- Event `Fields` are **whitelisted**, never arbitrary passthrough.
- Raw log writes pass through a redactor replacing the live token set,
  `QbitPass`, and the pairing code with `***`.
- `config.change` records key names only.

### 6.4 Client entries

1. **Contextual (primary)** — the subscription bar's `[详情]` opens a
   drawer pre-filtered to that `replicaId`. Two steps from "this show
   isn't moving" to "its RSS returns 403".
2. **Global** — Settings → Helper panel → "日志", tabs 事件 / 原始, with
   level filter, search, copy-all and the log file path. Desktop hangs it
   off `SettingsModal`'s `servers` / `appConnection` tab, which
   `openHelperSettings()` already targets; iOS off Servers → Helper
   connection.

Event lists virtualize, level renders as a color dot, rows expand to show
`Fields`. `info` and above by default; `debug` opt-in.

### 6.5 Relation to 5.1

`checkedAt` / `checkError` are not replaced by the event stream. The bar
needs a snapshot readable in O(1); the stream is history. Both exist, the
snapshot updated as a side effect of emitting the event.

## 7. iOS alignment

The two clients share no code — `packages/helper-protocol` is TypeScript,
iOS hand-writes `HelperContent.swift`. Every new field (`checkedAt`,
`checkError`, `Event`) is written twice, with the protocol doc as the
only synchronization point. This is the standing cost of full alignment.

| Concern | File | Change |
| --- | --- | --- |
| Merge the two actions | `MikanHelperActionView.swift` | `.subscribe` / `.backfill` collapse into one; subscribe chains backfill |
| Subscription bar | `MikanDetailHeader.swift:53` | "已订阅 · NAS" grows into the full bar |
| Episode badges | `MikanDetailView.swift` `MikanEpisodeRow` | `helperStatus(for:)` renders as a badge; join qB on infohash |
| Single-episode import | `MikanDetailView.swift:348-361` | Subscribed state keeps it only for skipped / needs-manual |
| Offline cache | `AppModel.swift` | Local snapshot; degrade instead of rendering empty |
| Polling | `AppModel.swift` | §4.3 cadence; stop on background |
| Log entry | `HelperConnectionView.swift` | 事件 / 原始 tabs |
| Protocol | `HelperService.swift` | `/check`, `/events`, `/logs`, plus `checkedAt` / `checkError` |

**Pull-to-refresh vs 立即检查** are different verbs and must read
differently: pull-to-refresh **re-reads Helper state**; 立即检查 **makes
the Helper fetch RSS**. The former stays as is; the latter lives in the
manage menu and spins the bar until `checkedAt` advances.

**Targeted splits.** `DiscoverView.swift` (964 lines) and
`MikanSubscriptionsView.swift` (553 lines) both exceed the 500-line
ceiling and this work adds to them. Split them where this work touches
them — Mikan and M-Team into separate files, row view out of screen view.
No unrelated refactoring.

## 8. Error handling

### 8.1 No more silent disabled

`disabled={!helperPaired || !subgroupId}`
(`MikanBangumiHeaderActions.tsx:94`) is the literal cause of "I clicked
and nothing happened". A disabled button does not explain itself.

- The button is **always clickable**. With no paired Helper, clicking
  opens the pairing flow instead of relying on the user noticing a small
  link beside it.
- **The first subgroup is selected by default** once the detail loads,
  eliminating the `!subgroupId` state entirely.

### 8.2 Failure matrix

| Situation | What the UI says | Subscription holds |
| --- | --- | --- |
| No paired Helper | Click → pairing flow | — |
| `PUT` 409 revision conflict | Silently re-fetch, merge, retry (≤3) | ✅ |
| PUT ok, backfill failed | "已订阅 · 等待下次检查", **not an error** | ✅ |
| Partial multi-target success | Bar reports per server | partial |
| 401 token expired | Clear binding + "需要重新配对" | ❌ |
| RSS fetch failed | Red bar + `[详情]` → event stream | ✅ |
| qBittorrent unreachable | "无法连接 qBittorrent" | ✅ |
| Episode skipped / needs-manual | Neutral badge + reason + remedy, **not an error** | ✅ |
| Helper unreachable | Cached render + "离线 · 上次同步 x" | ✅ |

Row three is the easiest to get wrong: a failed backfill **must not roll
back the subscription**. The replica is already on the Helper; rolling
back would leave the client claiming nothing is subscribed while the
Helper downloads. Desktop also lacks the 409 merge-retry that iOS's
`HelperSubscriptionCoordinator` already implements — `pushServers` errors
out instead.

## 9. Testing

TDD, red before green. Existing base: `actions.test.ts` (625 lines),
`subscription-view.test.ts`, `desired-set.test.ts`, Go `diff_test.go` /
`variant_test.go` / `identify_test.go`, iOS `HelperServiceTests.swift`.

**Go**
- Loop emits events: RSS failure emits `warn`; skip decisions carry a
  reason; `checkedAt` / `checkError` persist correctly
- `/events` cursor pagination, level and replicaId filtering
- **Redactor unit test plus endpoint assertions: tokens, qB password and
  pairing code must not appear in `/events` or `/logs` responses**
- Kicked tick and scheduled tick serialize on `workMu` without reentry

**TypeScript**
- Orchestration order PUT → backfill×N → status, and backfill failure
  does not roll back
- 409 → merge → retry ≤3
- `subscriptionFor` three-source precedence; `episodeStateFor` picks the
  least advanced across targets
- Poll cadence transitions: active 5s / settled 30s / blurred stopped /
  in-flight dedup

**iOS**
- New endpoint decoding; degrade to cache instead of an empty list when
  the Helper is unreachable

Verification is scoped to changed files: lint and typecheck only, no
full-project run, no build.

## 10. Delivery phases

1. **Helper** — replica check state, kick on write, `POST /check`, event
   stream, raw log, redaction. Independently shippable and immediately
   useful for diagnosing the current problem.
2. **Desktop** — merged action, subscription bar, episode badges with qB
   join, polling, source-of-truth switch, log drawer and panel, always-
   clickable subscribe.
3. **iOS** — the §7 table, including the targeted file splits.

## 11. Out of scope

- A subscription activity timeline as a first-class product surface
  (the event stream covers diagnosis; a curated history waits for demand)
- Promoting subscriptions to a top-level main-window page
- "Follow new episodes only" semantics and the Helper watermark it would
  require
- SSE / WebSocket transport
- Sharing protocol types between TypeScript and Swift
