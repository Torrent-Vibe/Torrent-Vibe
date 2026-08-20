# Mikan Subscription UX Rework — Task Decomposition

Spec: `docs/superpowers/specs/2026-08-20-mikan-subscription-ux-design.md`
(the spec is the binding authority; this file only slices it into tasks)

Branch: `feat/mikan-subscription-ux`

## Global Constraints

Binding on every task. Violating any of these is a review failure.

**Comments — zero by default.** Write NO comments and NO JSDoc. Good
identifiers carry the meaning. A comment is allowed only for (a) genuinely
unexpected behavior (a workaround for a library bug, a race, a platform
quirk) or (b) a hidden invariant a future reader would otherwise reverse.
Forbidden always: JSDoc blocks on internal functions/components/hooks/
handlers, comments restating what the code does, section-divider comments,
task/PR references, TODO/FIXME without a tracked ticket. Before finishing,
re-scan your diff for `//`, `/*`, `/**` and delete every one that fails the
test "would removing this confuse a reader who can read the code?".
Go doc comments on exported package-level identifiers are the one
exception, and only where the surrounding package already has them.

**File size.** Max 500 lines per file; React components under 300. If your
change pushes a file past the limit, split it as part of the task.

**Follow existing patterns.** Match the imports, naming, directory layout,
and store/actions idiom already in the touched area. Read the neighbours
before writing.

**TDD.** Write the failing test first, watch it fail, then implement. Every
task lists its required tests; those are a floor, not a ceiling.

**Verification is scoped to changed files.** Run the tests named in the
task plus `pnpm -F @torrent-vibe/renderer lint --  <changed files>` /
`go vet ./...` / `gofmt` as applicable. Do NOT run a full project build.
Do NOT run lint or typecheck over the whole repo.

**i18n.** All user-facing strings go through i18n. Keys are FLAT
dot-notation in `locales/app/en.json` AND `locales/app/zh-CN.json` — add to
both files, keep them in the same sorted position. Never hardcode a
user-facing string in a component. iOS strings stay inline Chinese,
matching the existing iOS code.

**Secrets.** Never log, serialize, or echo tokens, qBittorrent passwords,
or pairing codes. This is asserted by tests in Task 2 and 7.

**Commit.** One commit per task (or a small series), conventional-commit
style matching `git log` on this repo. Never add AI co-authorship
trailers. Never amend or force-push.

**Backward compatibility.** Older Helpers omit new fields; clients must
degrade, never crash. Newer Helpers must still serve older clients.

---

## Phase 1 — Helper (Go, `apps/helper-go`)

Independently shippable. Everything here is additive.

### Task 1: Event model, ring buffer, JSONL sink

New package `internal/events`.

```go
type Event struct {
    Seq        uint64         `json:"seq"`
    At         time.Time      `json:"at"`
    Level      string         `json:"level"`      // debug|info|warn|error
    Kind       string         `json:"kind"`
    ReplicaID  string         `json:"replicaId,omitempty"`
    BangumiID  string         `json:"bangumiId,omitempty"`
    SubgroupID string         `json:"subgroupId,omitempty"`
    EpisodeID  string         `json:"episodeId,omitempty"`
    Message    string         `json:"message"`
    Fields     map[string]any `json:"fields,omitempty"`
}

type Query struct {
    Since     uint64
    Level     string
    ReplicaID string
    Kind      string
    Limit     int
}

type Recorder interface {
    Emit(Event)
    Query(Query) ([]Event, uint64)
}
```

Exact values:
- Ring buffer capacity **2000** events in memory.
- Disk sink: `<dataDir>/logs/events-YYYYMMDD.jsonl`, one JSON object per
  line, appended. Retention **7 days** — prune older files on rotation.
- `Seq` starts at 1 and increases monotonically across the process
  lifetime. It does not reset on day rollover.
- `Query.Limit` defaults to 200 and is capped at 1000.
- `Query` returns events with `Seq > Since`, oldest first, plus the highest
  seq in the store as the next cursor.
- Level filtering is minimum-level: `warn` returns `warn` and `error`.
- `Emit` must be safe from concurrent goroutines and must never block the
  caller on disk I/O errors — a failed disk write is dropped silently after
  the in-memory append succeeds.

Tests (`events_test.go`): ring wraps past capacity and keeps the newest
2000; seq is monotonic under concurrent Emit; Query filters by since /
level / kind / replicaId; limit cap applies; JSONL lines round-trip; files
older than 7 days are pruned.

### Task 2: Redactor and field whitelist

New package `internal/redact`.

- `type Registry struct{}` with `Add(secret string)`, `Remove(secret string)`,
  and `Apply(s string) string` replacing every registered secret with
  `***`. Empty and whitespace-only secrets are ignored. Shortest-secret-
  last ordering so overlapping secrets fully redact.
- Concurrency-safe (`sync.RWMutex`).
- `AllowedFields(kind string) []string` — the per-kind whitelist. An event
  field whose key is not whitelisted for that kind is dropped before the
  event is stored. Whitelist:

| Kind | Allowed field keys |
| --- | --- |
| `tick.start` | `replicaCount` |
| `tick.done` | `replicaCount`, `addedCount`, `durationMs` |
| `rss.fetch` | `url`, `httpStatus`, `itemCount`, `durationMs`, `error` |
| `episode.new` | `title` |
| `episode.skip` | `reason`, `rival` |
| `episode.manual` | `reason` |
| `torrent.fetch` | `url`, `error` |
| `qb.add` | `hash`, `savePath`, `category`, `tags`, `error` |
| `qb.rename` | `from`, `to`, `error` |
| `episode.done` | `hash` |
| `subscription.put` | `added`, `removed` |
| `subscription.check` | `source` |
| `config.change` | `keys` |
| `pair` / `unpair` | `clientId` |

- String values inside `Fields` and the `Message` also pass through
  `Apply` before storage.

Tests (`redact_test.go`): registered token/password/pairing-code never
survive `Apply`; overlapping secrets; unknown field keys are dropped;
whitelisted keys survive; concurrent Add/Apply is race-free
(`go test -race`).

### Task 3: Raw log capture

New file `internal/logfile/logfile.go`.

- `Open(dataDir string, r *redact.Registry) (io.Writer, func() error, error)`
  returning a writer that appends to `<dataDir>/logs/helper.log`.
- Rolling: rotate when the file reaches **5 MB**, keep **3** files total
  (`helper.log`, `helper.log.1`, `helper.log.2`).
- Every line passes through `redact.Registry.Apply` before being written.
- In `cmd/torrent-vibe-helper/main.go`, wrap `os.Stdout` and `os.Stderr`
  through `io.MultiWriter(original, logfile)` right after the data dir is
  resolved, so the existing `fmt.Printf` startup lines land in the file.
  Do NOT change the systemd unit's `StandardOutput`.

Tests (`logfile_test.go`): rotation triggers at the size threshold; only 3
files are kept; a registered secret written through the writer appears as
`***` in the file.

### Task 4: Loop instrumentation

Wire `internal/events` into `internal/loop`.

- `loop.Deps` gains `Events events.Recorder` (nil-safe: a nil recorder
  means no emission, so existing tests keep compiling).
- Change `Deps.FetchRSS` from `func(url string) (string, error)` to
  `func(url string) (RSSResult, error)` where
  `type RSSResult struct { Body string; StatusCode int; Duration time.Duration }`.
  Update `main.go`'s `out.fetchString` wiring and every existing loop test
  accordingly.
- Emit, with the exact kinds and fields from Task 2's whitelist:
  - `tick.start` (info) at the top of `runTick`
  - `tick.done` (info) with `addedCount` = episodes newly added this tick
  - `rss.fetch` — `info` on success, `warn` on failure, always carrying
    `url`, `httpStatus`, `itemCount`, `durationMs`, and `error` when failed.
    **This replaces the current silent `if err == nil` swallow at
    `loop.go:105`.**
  - `episode.skip` (info) with `reason` (the existing
    `mikan.SkipReasonLanguage` / `SkipReasonResolution` value) and `rival`
    (the winning candidate's title)
  - `episode.manual` (info) with `reason` = `no-episode-number` or
    `collection`
  - `torrent.fetch` (error) on torrent download failure
  - `qb.add` — `info` on success with `hash`/`savePath`/`category`/`tags`,
    `error` level on failure with `error`
  - `qb.rename` — `info` per successful rename with `from`/`to`, `error` on
    failure
  - `episode.done` (info) when an episode reaches `done`
- Every event carries `ReplicaID`, `BangumiID`, `SubgroupID`, and
  `EpisodeID` where they are known.

Tests (`loop_test.go` additions): a failing RSS fetch emits exactly one
`rss.fetch` at `warn` carrying the status code and error; a successful tick
emits `tick.start` and `tick.done` with a correct `addedCount`; a
variant-pick loser emits `episode.skip` with its reason and rival; a
collection emits `episode.manual`; a qB add failure emits `qb.add` at
`error`.

### Task 5: Per-replica check state

- `internal/store`: new record persisted alongside episodes —
  `map[string]ReplicaCheck` keyed by `EpisodeKey(bangumiID, subgroupID)`:

```go
type ReplicaCheck struct {
    CheckedAt            time.Time `json:"checkedAt"`
    CheckError           string    `json:"checkError,omitempty"`
    ConsecutiveFailures  int       `json:"consecutiveFailures"`
}
```

  with `LoadReplicaChecks()` / `SaveReplicaChecks()` following the existing
  `LoadEpisodes` / `SaveEpisodes` idiom and file-locking discipline.
- `loop.Deps` gains `OnReplicaChecked func(replicaKey string, at time.Time, err error)`;
  `runTick` calls it once per replica after the RSS attempt. A successful
  check resets `ConsecutiveFailures` to 0 and clears `CheckError`; a failure
  increments it and stores the message.
- `httpx` `/status` `replicaStatus` gains `checkedAt` (RFC3339, omitted when
  zero), `checkError` (omitted when empty), `consecutiveFailures`.

Tests: check state persists and reloads; success resets the counter;
consecutive failures increment; `/status` surfaces all three fields;
absent state omits the fields rather than emitting zero values.

### Task 6: Kick on write, `POST /check`, capabilities

- `httpx.Runtime` gains `OnKick func(source string)`. `main.go` wires it to
  `go func() { _ = loop.Tick(makeDeps(rt.Config)) }()`. `loop.Tick` already
  serializes on `workMu`; do not restructure the loop.
- `PUT /subscriptions` calls `rt.OnKick("subscriptions")` after a
  successful save, before writing the response. It must not block the
  response on the tick.
- New route `POST /check` (authed) → `rt.OnKick("check")`, responds **202**
  with `{"ok":true}`. It triggers a FULL tick and accepts no per-replica
  filter; a request body, if present, is ignored.
- Emit `subscription.put` (with `added`/`removed` counts) and
  `subscription.check` (with `source`) events.
- `GET /discover` `capabilities` gains `"events"`, `"logs"`, `"check"`.

Tests (`server_test.go` additions): PUT triggers exactly one kick on
success and none on a 409 conflict; `POST /check` returns 202 and kicks;
`/check` requires auth; capabilities include the three new strings;
concurrent kicked + scheduled ticks do not reenter (`go test -race`).

### Task 7: `GET /events` and `GET /logs`

- `GET /events` (authed): query params `since` (uint64), `level`,
  `replicaId`, `kind`, `limit`. Responds
  `{"events":[...],"cursor":<uint64>}`. Invalid numeric params are treated
  as absent, not as errors.
- `GET /logs` (authed): query param `tail` (int, default 500, cap 5000).
  Responds `text/plain; charset=utf-8` with the last N lines of
  `helper.log`. A missing log file is a 200 with an empty body, not a 404.
- Both wire through the recorder/registry created in `main.go`.

Tests: cursor pagination returns only newer events and advances; level and
replicaId filters; limit cap; auth required for both; `tail` cap; **and an
assertion that a registered token, the qBittorrent password, and the
pairing code appear nowhere in either response body** after being emitted
into an event field and written to the raw log.

---

## Phase 2 — Desktop (`layer/renderer`, `packages/helper-protocol`)

### Task 8: Protocol and client bindings

- `packages/helper-protocol/src/types.ts`: add `HelperEvent` mirroring the
  Go struct (camelCase JSON as emitted).
- `layer/renderer/src/modules/helper-client/types.ts`:
  `HelperReplicaStatus` gains `checkedAt?: string`, `checkError?: string`,
  `consecutiveFailures?: number`.
- `api.ts`: `getHelperEvents(baseUrl, token, query)`,
  `getHelperLogs(baseUrl, token, tail)`, `checkHelper(baseUrl, token)`,
  following the existing hand-rolled parse-and-validate style in that file
  (no schema library). Unknown/malformed fields degrade to defaults.
- A `helperCapabilities(serverId)` helper exposing whether `events`,
  `logs`, `check` are advertised.
- Export the new symbols from `helper-client/index.ts`.

Tests (`api.test.ts` or a new `events-api.test.ts`): parses a well-formed
events payload; tolerates missing optional fields; tolerates a legacy
`/status` payload with no `checkedAt`.

### Task 9: Subscription selector and episode-state resolution

New `layer/renderer/src/modules/subscriptions/selectors.ts`.

- `subscriptionFor(bangumiId, subgroupId, state)` merging the three
  sources. Precedence for **existence**: in-flight optimistic write >
  Helper snapshot > local cache. Returns the record plus a
  `source: 'optimistic' | 'helper' | 'cache'` marker so the bar can render
  "离线 · 上次同步 x".
- Rewrite `episodeStateFor` (currently in `mikan/subscription-view.ts`) to
  consider **only the subscription's own target servers** and, when they
  disagree, return the **least advanced** state. Order, least to most
  advanced: `pending` < `added` < `downloading` < `renaming` < `done`;
  `failed`, `needs-manual` and `skipped` are terminal and win over any
  non-`done` state when present on any target.
- `subscriptionProgress(record, state)` returning
  `{ ready, total, failed }` where `total` = the Helper replica's episode
  count, `ready` = episodes in `done`, `failed` = `failed` + `needs-manual`.

Tests: precedence order; least-advanced resolution across two targets;
progress counts; a Helper-unreachable state falls back to cache with
`source: 'cache'`.

### Task 10: Subscribe orchestration

`layer/renderer/src/modules/subscriptions/actions.ts`.

- `subscribe()` becomes: optimistic write → `PUT /subscriptions` per target
  → `POST /backfill` per target (fed with the caller-supplied episode list)
  → `refreshStatus()` → return.
- `backfill()` fans out over **every** target server, not just
  `resolveCurrentServerId()`.
- `pushServers()` handles **409**: re-`GET /subscriptions`, merge the local
  desired set onto the returned revision, retry, **max 3 attempts**, then
  surface an error. Mirror the merge semantics of iOS's
  `HelperSubscriptionCoordinator`.
- **A failed backfill must NOT roll back the subscription.** It resolves as
  `{ ok: true, warning: 'backfillFailed' }`; only a failed PUT rolls back
  the optimistic write.
- Optimistic episode states fill only episodes with no real state yet.

Tests (`actions.test.ts` additions): call order PUT → backfill×N → status;
backfill fans out to all targets; a backfill rejection leaves the
subscription present and returns the warning; a 409 merges and retries and
gives up after 3; a PUT failure rolls back.

### Task 11: Status polling lifecycle

New `layer/renderer/src/modules/subscriptions/polling.ts`.

- `startSubscriptionPolling()` / `stopSubscriptionPolling()`.
- **5000 ms** while any tracked episode is in `pending|added|downloading|renaming`;
  **30000 ms** when all are settled; stopped when the Discover route is
  closed or `document.visibilityState !== 'visible'`.
- Single-flight: one in-flight `refreshStatus` at a time; a pending tick
  that arrives while one is in flight is dropped, not queued. Abort the
  in-flight request on stop.
- Drive it from `MikanBody` (replacing the one-shot `refreshStatus` on
  mount) and from `SubscriptionsInitializer`.

Tests: interval selection from a given episode set; visibility change stops
and restarts; single-flight drops overlapping ticks.

### Task 12: Subscription bar

New `layer/renderer/src/modules/modals/DiscoverModal/mikan/MikanSubscriptionBar.tsx`
plus a pure `subscription-bar-model.ts` holding the display derivation.

Renders one line: target server names · `{ready}/{total} 就绪` ·
`{failed} 失败` (only when > 0) · relative "N 分钟前检查". When
`checkError` is set, the bar renders in the destructive style showing the
error and `连续 {consecutiveFailures} 次`, with a `[详情]` button (wired in
Task 16). When `source === 'cache'`, renders "离线 · 上次同步 {relative}".
Reuse the existing `RelativeTime` component.

New i18n keys (both locale files):
`discover.modal.mikan.subscriptionBar.ready`,
`.failed`, `.checkedAt`, `.checkFailed`, `.offline`, `.details`,
`.neverChecked`.

Tests: the pure derivation module — ratio, failure count, which variant
(healthy / error / offline) is selected.

### Task 13: Episode badges and qBittorrent join

- New `episode-badge.ts` (pure) mapping a `HelperEpisodeState` to
  `{ icon, tone, labelKey }`. Tones: `done` → success, `downloading` /
  `renaming` → accent, `pending` / `added` → neutral, `failed` → destructive,
  `needs-manual` → warning, `skipped` → muted.
- Join `HelperEpisodeStatus.infohash` against the existing torrent data
  store to render live percent and speed on `downloading` rows. Match
  case-insensitively. No Helper call.
- `MikanEpisodeList` renders the badge as a leading element on the row, not
  as text between size and date.
- In the subscribed state, drop the per-row `[只下这集]` button except on
  `skipped` and `needs-manual` rows, where it reads `仍要下载` and calls the
  existing retry/import path. In the unsubscribed state keep it on every row.
- Clicking a row with a known infohash navigates to that torrent in the
  main window.

New i18n keys: `discover.modal.mikan.episodeState.skipped`,
`discover.modal.mikan.downloadAnyway`.

Tests: badge mapping for every state; the infohash join picks the right
torrent and formats percent; case-insensitive match.

### Task 14: Header actions merge and always-clickable subscribe

`MikanBangumiHeaderActions.tsx` and `MikanBangumiPage.tsx`.

- Remove the `导入已出` button entirely. Remove
  `backfillReleasedEpisodes`'s standalone entry point (the function stays,
  now called by Task 10's orchestration).
- One primary button: `订阅` when unsubscribed, `管理订阅 ▾` when
  subscribed. The menu holds 编辑目标服务器 / 立即检查 / 取消订阅.
  `立即检查` calls `checkHelper` and is hidden when the `check` capability
  is absent.
- **The subscribe button is never `disabled`.** With no paired Helper,
  clicking opens the pairing settings (`openHelperSettings()`).
- The first subgroup is selected by default once the detail loads, so
  `subgroupId` is never null when subgroups exist.
- Remove the standalone `取消订阅` ghost button from the page body
  (`MikanBangumiPage.tsx:104-118`).
- Subgroup chips: a dot marker on subscribed subgroups.
- When the selected subgroup is unsubscribed but another subgroup of the
  same bangumi is subscribed, render a passive hint row with a button that
  switches to the subscribed subgroup. Never block the subscribe action.

New i18n keys: `discover.modal.mikan.manageSubscription`,
`.checkNow`, `.otherSubgroupSubscribed`, `.switchToSubscribed`.

Tests: the pure helper deciding button mode from (paired, subscription);
the other-subgroup hint predicate.

### Task 15: Subscriptions entry in the detail header

- `MikanChrome.tsx` renders `MikanSubscriptionBadge` in the bangumi-detail
  branch too, not only the browse branch.
- The badge count turns destructive-toned when any subscription has a
  `failed` / `needs-manual` episode or a `checkError`; otherwise neutral.

Tests: the pure predicate choosing badge tone from the subscription set.

### Task 16: Log drawer and settings log panel

- `layer/renderer/src/modules/helper-client/HelperLogPanel.tsx` — two tabs,
  `事件` and `原始`.
  - Events tab: level filter (default `info` and above, `debug` opt-in),
    free-text search, virtualized list (reuse the project's existing
    virtualization approach), rows expandable to show `fields`, level shown
    as a color dot, copy-all.
  - Raw tab: `GET /logs?tail=500`, monospace, copy-all, and the log file
    path displayed and copyable.
  - Incremental polling every **2000 ms** using the `since` cursor while
    the panel is open; stopped when closed.
- Mount it in `SettingsModal` under the `servers` / `appConnection` tab.
- Contextual entry: the subscription bar's `[详情]` opens the same panel in
  a drawer, pre-filtered to that `replicaId`.
- Both entries are hidden when the `events` capability is absent, replaced
  by a one-line "Helper 版本过旧" notice.

New i18n keys under `helper.logs.*`: `title`, `tabEvents`, `tabRaw`,
`levelFilter`, `search`, `copyAll`, `filePath`, `tooOld`, `empty`.

Tests: the pure filter/merge logic for incremental cursor appends
(no duplicate seqs, ordering preserved).

---

## Phase 3 — iOS (`apps/ios`)

Swift. Strings stay inline Chinese, matching existing code. Tests go in
`apps/ios/Tests`. Verify with
`xcodebuild test -project apps/ios/TorrentVibe.xcodeproj -scheme TorrentVibe -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -quiet`.

### Task 17: HelperService endpoints and model fields

- `HelperContent.swift`: `HelperReplicaStatus` gains `checkedAt: Date?`,
  `checkError: String?`, `consecutiveFailures: Int` (default 0). New
  `HelperEvent` struct mirroring Task 1's JSON.
- `HelperService.swift`: `events(at:token:since:level:replicaId:limit:)`,
  `logs(at:token:tail:)`, `check(at:token:)`, plus capability parsing from
  `/discover`.
- Decoding must tolerate a legacy payload with none of the new fields.

Tests (`HelperServiceTests.swift`): decodes new fields; decodes a legacy
payload; events request builds the right query string; `check` posts and
accepts 202.

### Task 18: Offline cache

`AppModel.swift` — persist the last good `HelperSubscriptionSnapshot` +
`runtimeStatus` per server (UserDefaults or the app's existing persistence
idiom, whichever the file already uses). When the Helper is unreachable,
render from the cache with an offline marker instead of an empty list.

Tests: cache round-trip; unreachable Helper yields cached groups, not an
empty array.

### Task 19: Status polling

`AppModel.swift` — the same cadence as Task 11: 5s active, 30s settled,
stopped when the app is backgrounded or no Mikan surface is visible.
Single-flight.

Tests: interval selection from an episode set; background stops polling.

### Task 20: Merge the two actions

`MikanHelperActionView.swift` — collapse `.subscribe` and `.backfill` into
one action. Subscribing chains the backfill for every target, matching
Task 10's semantics including "a failed backfill does not undo the
subscription". Update the confirm copy: the button reads `订阅`, the
confirmation explains the whole season will be fetched. Keep the existing
accessibility identifiers where they still apply; the backfill-specific
identifier is removed.

Tests: the outcome model for a partial (subscribe-ok, backfill-failed)
result reports success with a warning.

### Task 21: Subscription bar

`MikanDetailHeader.swift:53` — replace the "已订阅 · {servers}" line with
the full bar: servers · ready/total · failures · relative check time ·
`checkError` variant · offline variant. Same content as Task 12.

Tests: the display-model derivation (ratio, variant selection).

### Task 22: Episode badges and qB join

`MikanDetailView.swift` `MikanEpisodeRow` — render `helperStatus(for:)` as
a badge with the same tone mapping as Task 13, joined against the app's
qBittorrent torrent list on infohash for live percent. Per-row import stays
only for `skipped` / `needs-manual` in the subscribed state.

Tests: tone mapping; infohash join.

### Task 23: Log entry

`HelperConnectionView.swift` — a "日志" entry opening a screen with the
same two tabs (事件 / 原始), level filter, search, copy, file path, 2s
incremental polling while visible. Hidden when the `events` capability is
absent.

Tests: the incremental cursor merge logic.

### Task 24: File splits

Split only the files this work touched past the limits:
- `DiscoverView.swift` (964 lines) — separate the Mikan and M-Team surfaces
  into their own files.
- `MikanSubscriptionsView.swift` (553 lines) — extract the row view from
  the screen.
No behavior change, no unrelated refactoring. The existing tests plus a
clean `xcodebuild test` are the verification.
