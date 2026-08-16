# Bangumi Discover UI — Design Spec

2026-08-16 · Status: approved

Supersedes the chrome, tabs, and view-stack sections of
`2026-08-15-mikan-discover-design.md`. Helper pairing, subscriptions as
source of truth, Mikan HTTP provider, and M-Team Discover behavior are
unchanged except where this spec names a chrome or navigation change.

## 1. What it is

Mikan Discover is a bangumi browser inside the existing Discover modal:
browse this season’s poster wall, search the whole catalog, drill into a
show, and manage subscriptions. It is not a media library and not a
second product surface.

The 8/15 implementation already does those jobs, but it inherited
M-Team’s “search torrents” chrome (title, subtitle, provider, settings,
search, season, SegmentTab). This spec replaces that information
architecture.

## 2. Decisions

| Topic | Choice |
| --- | --- |
| Primary jobs | Season wall and bangumi search are equal. Subscriptions are secondary. |
| Top-level views | One Browse surface. Empty query = season wall. Non-empty = site-wide search grid. |
| Subscriptions entry | Header badge with count, not a peer tab. |
| Drill-in | True stack. Detail and subscriptions replace the whole Mikan interior, including Browse chrome. |
| Shared Discover header | Mikan does not show “发现资源” / subtitle. It uses the same header shell with slots. |
| Stack depth | At most two frames: Browse → subscriptions → bangumi. Bangumi cannot push subscriptions. |
| Season picker | Visible only on the empty-query wall. Hidden while searching. |
| Helper status | Persistent chip on Browse. On stack pages, only beside disabled subscribe / bulk-import. |
| Implementation | `MikanWorkspace` inside `DiscoverModal`. M-Team keeps the current header + list + preview. |
| Header reuse | `DiscoverModalHeader` becomes a slotted chrome shell, not a Mikan/M-Team fork. |

## 3. Out of scope

- Moving Mikan to its own modal or first-class route
- Redesigning M-Team Discover beyond sharing the header shell
- Helper pairing, desired-state push, rename, or Mikan HTML parsing
- iOS
- NFO / local media index
- Mikan account / MyBangumi
- Changing search to be season-scoped

## 4. View tree

```
Discover modal
├─ Mikan  (MikanWorkspace)
│   ├─ Browse          []                         root
│   │    empty query → season wall (year/season visible)
│   │    query       → search grid (year/season hidden)
│   ├─ Subscriptions   [{ subscriptions }]        badge push
│   └─ Bangumi         [{ bangumi }]              from wall/search
│                      [{ subscriptions }, { bangumi }]
│                                                 from subscription row
└─ M-Team              existing list + preview
```

Navigation:

- Badge → replace stack with `[{ subscriptions }]`. If that frame is
  already top, no-op.
- Poster on wall or search → `[{ bangumi }]`.
- Cover on a subscription row → `[{ subscriptions }, { bangumi }]`.
- Back = pop one frame. Returning from bangumi-from-subs lands on the
  subscription list, then Browse.
- Provider switch away from Mikan clears the stack. Keyword, year, and
  season stay.
- Closing the modal dismisses Discover; next open restores last provider
  as today. Stack starts empty.

Browse scroll: store `wall` and `search` scrollTop separately. Write the
active one before push or before switching wall ↔ search. Restore after
pop using the mode implied by the current keyword.

## 5. Chrome

### 5.1 Header shell

`DiscoverModalHeader` owns height, macOS traffic-light inset, border, and
the trailing chrome. It does not know about wall, search, or stack.

```tsx
<DiscoverModalHeader
  start={...}      // remaining width
  end={...}        // flush against trailing chrome
  provider         // default true; false on Mikan stack
  settings         // true only for M-Team
  onClose={dismiss}
/>
```

| Surface | `start` | `end` | provider | settings |
| --- | --- | --- | --- | --- |
| M-Team | Title + subtitle | — | on | on |
| Mikan Browse | Search | Year/season (empty query only), subscription badge, Helper chip | on | off |
| Mikan stack | Back + title | Bangumi page actions | off | off |

Slots must not grow a second row. Mikan is a single toolbar row. M-Team
may stack title and subtitle inside `start`, which is allowed to make
that header taller.

Unready providers stay in the provider Select and open Discover
settings on pointer-down, same as today. Mikan has no dedicated settings
button.

### 5.2 Browse toolbar contents

- Search takes remaining width. Placeholder: 搜番名.
- Year and season Selects render only when `keyword` is empty.
- Badge: `订阅 N`. `N` is the global subscription row count. Click
  pushes the subscriptions frame. Hidden while the stack is non-empty.
- Helper chip: green dot + current server name when paired and
  reachable; otherwise “未绑定” / “不可达”. Click opens Servers
  (Electron) or app connection (web).
- Provider Select + close.

No SegmentTab. No “发现资源” title.

### 5.3 Stack toolbar contents

- Back pops.
- Title: `我的订阅` on the subscriptions frame; bangumi title on the
  bangumi frame (list title until detail arrives).
- Bangumi `end` is the only place for 导入该组已出 and 订阅 / 编辑目标.
  Do not repeat those buttons in the page body. Disabled when Helper
  is not paired on the current server, with a bind affordance next to
  the disabled controls. Unsubscribe stays in the page body.
- Subscriptions `end` is empty.
- Close dismisses Discover.

The bangumi page no longer renders its own back button.

## 6. Architecture

`DiscoverModal` only routes:

- `activeProviderId === 'mikan'` → `MikanWorkspace`
- else → current M-Team layout (filter bar, list, preview)

Last-provider memory and “unready → first ready, rewrite memory” stay
in Discover. The Mikan provider control is drawn in the header shell
that Workspace fills.

`MikanWorkspace` is the only Mikan chrome owner. It chooses Browse vs
stack slots from `mikanStack` and renders one of: season wall, search
grid, subscriptions tab, bangumi page.

```
MikanWorkspace
  DiscoverModalHeader   (slots)
    start/end filled by Browse or stack contents
  body
    MikanSeasonWall | MikanSearchResults
    MikanSubscriptionsTab | MikanBangumiPage
```

`MikanWorkspace` replaces `MikanDiscoverShell` as the Mikan root. Wall,
search, subscriptions, and bangumi page components stay and only change
navigation calls plus the bangumi back button.

Subscriptions store, Helper client, and `packages/mikan` are untouched.

## 7. Data

### 7.1 Store

Remove `mikanTab`.

Add:

```ts
type MikanStackFrame =
  | { type: 'subscriptions' }
  | { type: 'bangumi'; bangumiId: string }

mikanStack: MikanStackFrame[]
mikanBrowseScroll: { wall: number; search: number }
```

`mikanBangumiId` is not the router. It is the detail-cache pointer:
equal to the top `bangumi` frame’s id, cleared when the top frame is
not bangumi.

`keyword`, `filters.year`, `filters.season`, `items`, and existing
mikan detail fields stay.

### 7.2 Actions (mikan slice only)

- `pushSubscriptions()` — if stack is empty, set `[{ subscriptions }]`.
  If top is already subscriptions, no-op. Must not run when top is
  bangumi (badge is not on the stack toolbar).
- `pushBangumi(item)` — from Browse (`stack` empty): `[{ bangumi }]`.
  From subscriptions: append, max two frames. Reject a third frame.
  Also runs the current detail fetch and last-subgroup restore.
- `popStack()` — pop one frame. If the popped frame was bangumi, clear
  `mikanDetail*`.
- Provider configure / switch away from Mikan: `mikanStack = []`.
  Keyword and season filters remain.

UI never writes the stack directly.

Subscription create / retarget / unsubscribe / retry / status refresh
stay on `SubscriptionActions`.

### 7.3 Search

`performSearch` runs only when `providerReady` and `mikanStack` is
empty. Keyword or season change uses the current debounce: 350ms when
the keyword is non-empty, immediate when empty. A non-empty stack must
not fire search and must not replace `items`.

Season Selects hide as soon as `keyword.trim()` is non-empty. The body
still shows the wall until a committed non-empty search exists, then
the search grid. A pending debounce may therefore show the wall without
season Selects for a few hundred milliseconds.

### 7.4 Page actions

Single-episode import, bulk “导入该组已出”, and subscribe / edit targets
keep the current actions. Bulk import and subscribe/edit are invoked
only from the stack header `end` slot. Single-episode import stays on
the episode row and still goes to the current qBittorrent, not the
Helper.

## 8. Error handling

| Failure | Behavior |
| --- | --- |
| Wall / search request fails | Empty state + retry on that surface. Do not wipe last good `items`. |
| Bangumi detail fails | Stay on the bangumi frame. Error bar + retry in the body. Back still pops. |
| Provider not ready | Workspace still mounts. Header shell and provider Select remain; search is disabled. Body shows the existing no-provider empty state. |
| Helper missing / unreachable | Browse chip is clickable. Stack pages disable subscribe and bulk import and show a bind link. Single-episode import stays enabled. |
| Subscribe or bulk import fails | Existing toast. Stack does not pop. |
| Return to Mikan after switching away | Stack is empty. Keyword and season remain. Browse refetches from that query. |

## 9. Testing

Pure logic, no live Mikan or qBittorrent.

- Stack: push/pop depth; bangumi from subscriptions; reject bangumi →
  subscriptions; provider switch clears stack and keeps keyword/season.
- Browse mode: empty keyword ⇒ season controls visible; non-empty
  keyword ⇒ season controls hidden. Body uses committed keyword:
  empty committed ⇒ wall; non-empty committed ⇒ search grid.
- Scroll: wall and search scrollTop stored separately; restore the
  matching one after pop.
- Detail pointer: `mikanBangumiId` set only while top is bangumi;
  cleared after that frame pops.

Header slots, true-stack transitions, and the Helper chip are a manual
pass. Existing last-provider, Mikan parse, and desired-state tests do
not change.

## 10. Implementation order

1. `MikanStackFrame` helpers + tests (push/pop rules, browse mode,
   detail pointer).
2. Store/actions: replace `mikanTab` with `mikanStack` and scroll
   memory; gate `performSearch` on empty stack.
3. Slot `DiscoverModalHeader`. Point M-Team at title + settings.
4. `MikanWorkspace` fills Browse and stack slots; delete SegmentTab
   and the bangumi in-page back button.
5. Wire badge, Helper chip, header page actions; manual pass of the
   five screens in the IA mockup.

## 11. Success

- Opening Mikan shows this season’s wall under one toolbar: search,
  season, badge, Helper, provider, close. No “发现资源”, no tabs.
- Typing a name hides the season picker and shows a poster grid.
  Clearing the query returns to the selected season wall.
- Opening a show or 我的订阅 replaces that toolbar with back + title.
  Back restores the previous surface and its scroll.
- From 我的订阅, a show is a second stack frame. Back returns to the
  list.
- M-Team Discover still uses the slotted header with title, subtitle,
  provider, settings, and close.
