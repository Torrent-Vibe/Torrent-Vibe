# Helper Go Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the TypeScript helper daemon with a Go binary that implements the full helper HTTP contract (including unpair, remote config, Bangumi fallback, and retry), and wire Electron pairing, install, mDNS browse, and retry UI to that contract.

**Architecture:** `apps/helper-go` is a static Go sidecar on each download host. Torrent-Vibe stays the subscription source of truth and talks JSON HTTP. `@torrent-vibe/mikan` HTML and `helper-protocol` stay TypeScript; Go copies wire types and ports only RSS + title parse against the same fixtures. Electron bindings stay one helper URL per server profile.

**Tech Stack:** Go 1.23, `net/http`, `net/http/httptest`, GitHub Release assets via `desktop-release`, Electron `electron-ipc-decorator`, existing helper-client + subscriptions store, Vitest for renderer tests.

**Spec:** `docs/superpowers/specs/2026-08-16-helper-contract-design.md`

## Global Constraints

- iOS is out of scope. Helper HTTP must stay a plain JSON API a later iOS client can call.
- One Torrent-Vibe ↔ N qBittorrent servers; one server profile ↔ 0 or 1 helper; one helper ↔ one local qBittorrent.
- One helper URL may be bound to at most one server profile in this Torrent-Vibe.
- Default listen port is `17890`. mDNS type is `_torrentvibe-helper._tcp`.
- Episode file name format is `{title} - SxxExx.ext`. Save path is `{libraryRoot}/{title}/Season {XX}/`.
- Unparseable titles must be `needs-manual` and must not be renamed to `S00E00`.
- Pairing never auto-binds. Pairing panel does not auto-fill the code from `GET /discover`.
- Do not implement the new routes on the TypeScript helper and then rewrite them. New behavior lives in Go only.
- Do not port `@torrent-vibe/mikan` HTML parsers.
- Do not add a helper HTML admin UI, SSH remote install, or per-client tokens.
- Zero comments / JSDoc in business code unless the behavior is unexpected.
- TDD: failing test first for every new behavior.
- Commit after each task. Do not commit unrelated dirty files.
- Never add AI co-authorship trailers.

## File map

```
apps/helper-go/
  go.mod
  cmd/torrent-vibe-helper/main.go
  Dockerfile
  internal/protocol/types.go
  internal/protocol/diff.go
  internal/protocol/diff_test.go
  internal/mikan/url.go
  internal/mikan/title.go
  internal/mikan/title_test.go
  internal/mikan/rss.go
  internal/mikan/rss_test.go
  internal/store/store.go
  internal/store/store_test.go
  internal/store/pairing.go
  internal/store/pairing_test.go
  internal/httpx/server.go
  internal/httpx/server_test.go
  internal/qb/client.go
  internal/qb/client_test.go
  internal/rename/rename.go
  internal/rename/rename_test.go
  internal/loop/loop.go
  internal/loop/loop_test.go
  internal/config/config.go
  internal/config/config_test.go
  internal/bangumi/client.go
  internal/bangumi/client_test.go
  internal/mdns/advertise.go
```

Electron / CI (later tasks):

- `layer/renderer/src/modules/helper-client/{api,bindings,types,index}.ts`
- `layer/renderer/src/modules/helper-client/install-command.ts`
- `layer/renderer/src/modules/helper-client/HelperPairingPanel.tsx` plus split children
- `layer/renderer/src/modules/subscriptions/actions.ts`
- `layer/main/src/ipc/helper-mdns.service.ts` + `services.ts`
- `locales/app/{en,zh-CN}.json`
- `.github/workflows/desktop-release.yml`
- Delete `apps/helper/` after cutover

---

### Task 1: Go module, protocol types, desired-state diff

**Files:**
- Create: `apps/helper-go/go.mod`
- Create: `apps/helper-go/internal/protocol/types.go`
- Create: `apps/helper-go/internal/protocol/diff.go`
- Create: `apps/helper-go/internal/protocol/diff_test.go`

**Interfaces:**
- Consumes: nothing
- Produces:

```go
package protocol

type EpisodeState string

const (
  StatePending     EpisodeState = "pending"
  StateAdded       EpisodeState = "added"
  StateDownloading EpisodeState = "downloading"
  StateRenaming    EpisodeState = "renaming"
  StateDone        EpisodeState = "done"
  StateFailed      EpisodeState = "failed"
  StateNeedsManual EpisodeState = "needs-manual"
)

type Replica struct {
  ID               string `json:"id"`
  BangumiID        string `json:"bangumiId"`
  Title            string `json:"title"`
  BangumiSubjectID string `json:"bangumiSubjectId,omitempty"`
  SubgroupID       string `json:"subgroupId"`
  SubgroupName     string `json:"subgroupName"`
  RSSURL           string `json:"rssUrl"`
}

type OpType string

const (
  OpAdd    OpType = "add"
  OpRemove OpType = "remove"
)

type DesiredOp struct {
  Type    OpType
  ID      string
  Replica Replica
}

func DesiredStateDiff(desired, current []Replica) []DesiredOp
```

Diff rules (same as `packages/helper-protocol/src/desired-state.ts`): key is JSON array of `id, bangumiId, title, bangumiSubjectId|null, subgroupId, subgroupName, rssUrl`. Missing id or changed key → remove then add. Removes first, then adds.

- [ ] **Step 1: Write the failing test**

```go
package protocol_test

import (
  "testing"

  "github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
)

func replica(id, title string) protocol.Replica {
  return protocol.Replica{
    ID: id, BangumiID: "b", Title: title,
    SubgroupID: "s", SubgroupName: "S", RSSURL: "https://x/rss",
  }
}

func TestDesiredStateDiffAddsMissing(t *testing.T) {
  ops := protocol.DesiredStateDiff([]protocol.Replica{replica("1", "A")}, nil)
  if len(ops) != 1 || ops[0].Type != protocol.OpAdd || ops[0].Replica.ID != "1" {
    t.Fatalf("%+v", ops)
  }
}

func TestDesiredStateDiffRemovesExtra(t *testing.T) {
  ops := protocol.DesiredStateDiff(nil, []protocol.Replica{replica("1", "A")})
  if len(ops) != 1 || ops[0].Type != protocol.OpRemove || ops[0].ID != "1" {
    t.Fatalf("%+v", ops)
  }
}

func TestDesiredStateDiffReplaceOnFieldChange(t *testing.T) {
  ops := protocol.DesiredStateDiff(
    []protocol.Replica{replica("1", "B")},
    []protocol.Replica{replica("1", "A")},
  )
  if len(ops) != 2 || ops[0].Type != protocol.OpRemove || ops[1].Type != protocol.OpAdd {
    t.Fatalf("%+v", ops)
  }
}

func TestDesiredStateDiffUnchanged(t *testing.T) {
  r := replica("1", "A")
  if ops := protocol.DesiredStateDiff([]protocol.Replica{r}, []protocol.Replica{r}); len(ops) != 0 {
    t.Fatalf("%+v", ops)
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/helper-go && go test ./internal/protocol/`
Expected: FAIL (`go.mod` missing and/or `DesiredStateDiff` undefined)

- [ ] **Step 3: Write minimal implementation**

```text
module github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go

go 1.23
```

Implement `types.go` and `diff.go` so the four tests pass. Port the TS key function literally (include `bangumiSubjectId` as empty vs omitted — treat missing as null in the key).

- [ ] **Step 4: Run tests and make sure they pass**

Run: `cd apps/helper-go && go test ./internal/protocol/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/helper-go/go.mod apps/helper-go/internal/protocol
git commit -m "feat(helper-go): add protocol types and desired-state diff"
```

---

### Task 2: Port Mikan title, URL, and RSS parsers

**Files:**
- Create: `apps/helper-go/internal/mikan/url.go`
- Create: `apps/helper-go/internal/mikan/title.go`
- Create: `apps/helper-go/internal/mikan/title_test.go`
- Create: `apps/helper-go/internal/mikan/rss.go`
- Create: `apps/helper-go/internal/mikan/rss_test.go`
- Read-only fixtures: `packages/mikan/fixtures/rss.xml`
- Read-only reference: `packages/mikan/src/{title,rss,urls}.ts`

**Interfaces:**
- Consumes: nothing
- Produces:

```go
package mikan

type ParsedTitle struct {
  Title   string
  Season  *int
  Episode *int
}

type RssEpisode struct {
  EpisodeID   string
  Title       string
  TorrentURL  string
  PublishedAt string
  SizeBytes   int64
}

func JoinMikanURL(baseURL, path string) string
func BangumiRSSURL(baseURL, bangumiID, subgroupID string) string
func TorrentDownloadURL(baseURL, href string) string
func ParseMikanTitle(raw string) ParsedTitle
func ParseBangumiRSS(xml, baseURL string) []RssEpisode
```

Use `*int` so JSON/`null` matches TS `number | null`. Zero is a valid episode and must not collapse to null.

- [ ] **Step 1: Write the failing title tests** (port every case in `packages/mikan/src/title.test.ts`)

```go
func TestParseMikanTitleANiDash(t *testing.T) {
  got := mikan.ParseMikanTitle("[ANi] 葬送的芙莉莲 - 28 [1080P]")
  if got.Title != "葬送的芙莉莲" || got.Season != nil || got.Episode == nil || *got.Episode != 28 {
    t.Fatalf("%+v", got)
  }
}

func TestParseMikanTitleCollectionHasNoEpisode(t *testing.T) {
  raw := "[喵萌奶茶屋&LoliHouse] 葬送的芙莉莲 / Sousou no Frieren [01-28 修正合集][WebRip 1080p HEVC-10bit AAC][简繁日内封字幕][Fin]"
  got := mikan.ParseMikanTitle(raw)
  if got.Title != "葬送的芙莉莲" || got.Episode != nil {
    t.Fatalf("%+v", got)
  }
}
```

Also port: romaji slash name, missing number, `S02E07`, `第07集`.

- [ ] **Step 2: Write the failing RSS / URL tests**

Read `packages/mikan/fixtures/rss.xml` from a path relative to the test file (`../../../../packages/mikan/fixtures/rss.xml`). Assert the same two episodes as `packages/mikan/src/rss.test.ts`:

- first: episodeId `a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c`, torrent URL rewritten onto `https://mikan.example`, `publishedAt` `2024-03-22T23:31:49.457`, `sizeBytes` `744908416`
- second: episodeId `238eeb554bcd07b86335c8f8d402a69c11b15789`, `sizeBytes` `653388672`

URL cases:

```go
func TestJoinAndTorrentURL(t *testing.T) {
  if got := mikan.JoinMikanURL("https://mikanani.me", "/Home/Bangumi/3141"); got != "https://mikanani.me/Home/Bangumi/3141" {
    t.Fatal(got)
  }
  if got := mikan.BangumiRSSURL("https://mikanani.me", "3141", "583"); got != "https://mikanani.me/RSS/Bangumi?bangumiId=3141&subgroupid=583" {
    t.Fatal(got)
  }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/helper-go && go test ./internal/mikan/`
Expected: FAIL (undefined functions)

- [ ] **Step 4: Port `title.ts`, `urls.ts`, `rss.ts` literally**

Keep the same regex order and quality-number set (`360,480,720,1080,1440,2160,4320`). XML entity decode and enclosure/id extraction must match the TS file.

- [ ] **Step 5: Run tests and make sure they pass**

Run: `cd apps/helper-go && go test ./internal/mikan/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/helper-go/internal/mikan
git commit -m "feat(helper-go): port Mikan title and RSS parsers"
```

---

### Task 3: Replica store and pairing.json

**Files:**
- Create: `apps/helper-go/internal/store/store.go`
- Create: `apps/helper-go/internal/store/store_test.go`
- Create: `apps/helper-go/internal/store/pairing.go`
- Create: `apps/helper-go/internal/store/pairing_test.go`

**Interfaces:**
- Consumes: `protocol.Replica`, `protocol.EpisodeState`
- Produces:

```go
package store

type Episode struct {
  EpisodeID string              `json:"episodeId"`
  Infohash  string              `json:"infohash,omitempty"`
  Title     string              `json:"title"`
  Season    *int                `json:"season"`
  Episode   *int                `json:"episode"`
  State     protocol.EpisodeState `json:"state"`
  LastError string              `json:"lastError,omitempty"`
}

func EpisodeKey(bangumiID, subgroupID string) string // "bangumiId:subgroupId"

type Store struct{} // methods below; construct with New(dataDir string)

func New(dataDir string) *Store
func (s *Store) LoadReplicas() ([]protocol.Replica, error)
func (s *Store) SaveReplicas([]protocol.Replica) error
func (s *Store) LoadEpisodes() (map[string][]Episode, error)
func (s *Store) SaveEpisodes(map[string][]Episode) error
func (s *Store) ClearAll() error // empty replicas + episodes

type Pairing struct {
  Bound bool   `json:"bound"`
  Token string `json:"token"`
}

func LoadPairing(dataDir string) (Pairing, error)
func SavePairing(dataDir string, p Pairing) error
func RotateToken(dataDir string) (Pairing, error) // bound=false, new 32-byte hex token
```

Persist replicas+episodes in `$DATA_DIR/replicas.json` (same shape as TS: `{ replicas, episodes }`, atomic write via temp + rename). Persist `{ bound, token }` in `$DATA_DIR/pairing.json`.

`LoadPairing`: if `pairing.json` missing and `$DATA_DIR/token` exists, import that token, `bound=false`, write `pairing.json`. If neither exists, generate a 32-byte hex token, `bound=false`, write `pairing.json`. Do not infer `bound=true` from token existence.

- [ ] **Step 1: Write failing store tests**

```go
func TestStoreRoundTrip(t *testing.T) {
  dir := t.TempDir()
  s := store.New(dir)
  r := protocol.Replica{ID: "1", BangumiID: "b", Title: "T", SubgroupID: "s", SubgroupName: "S", RSSURL: "https://x"}
  if err := s.SaveReplicas([]protocol.Replica{r}); err != nil {
    t.Fatal(err)
  }
  season, ep := 1, 28
  if err := s.SaveEpisodes(map[string][]store.Episode{
    store.EpisodeKey("b", "s"): {{EpisodeID: "e", Title: "t", Season: &season, Episode: &ep, State: protocol.StateAdded}},
  }); err != nil {
    t.Fatal(err)
  }
  got, _ := s.LoadReplicas()
  if len(got) != 1 || got[0].ID != "1" {
    t.Fatalf("%+v", got)
  }
  eps, _ := s.LoadEpisodes()
  if len(eps[store.EpisodeKey("b", "s")]) != 1 {
    t.Fatalf("%+v", eps)
  }
}

func TestStoreMissingFileIsEmpty(t *testing.T) {
  s := store.New(t.TempDir())
  reps, err := s.LoadReplicas()
  if err != nil || len(reps) != 0 {
    t.Fatalf("%v %+v", err, reps)
  }
}

func TestClearAll(t *testing.T) {
  dir := t.TempDir()
  s := store.New(dir)
  _ = s.SaveReplicas([]protocol.Replica{{ID: "1", BangumiID: "b", Title: "T", SubgroupID: "s", SubgroupName: "S", RSSURL: "https://x"}})
  if err := s.ClearAll(); err != nil {
    t.Fatal(err)
  }
  reps, _ := s.LoadReplicas()
  eps, _ := s.LoadEpisodes()
  if len(reps) != 0 || len(eps) != 0 {
    t.Fatal("not cleared")
  }
}
```

- [ ] **Step 2: Write failing pairing tests**

```go
func TestLoadPairingGeneratesTokenUnbound(t *testing.T) {
  p, err := store.LoadPairing(t.TempDir())
  if err != nil || p.Bound || len(p.Token) < 32 {
    t.Fatalf("%+v %v", p, err)
  }
}

func TestLoadPairingMigratesLegacyTokenUnbound(t *testing.T) {
  dir := t.TempDir()
  if err := os.WriteFile(filepath.Join(dir, "token"), []byte("legacy-token\n"), 0o600); err != nil {
    t.Fatal(err)
  }
  p, err := store.LoadPairing(dir)
  if err != nil || p.Bound || p.Token != "legacy-token" {
    t.Fatalf("%+v %v", p, err)
  }
  raw, _ := os.ReadFile(filepath.Join(dir, "pairing.json"))
  if !bytes.Contains(raw, []byte("legacy-token")) {
    t.Fatalf("%s", raw)
  }
}

func TestRotateTokenClearsBound(t *testing.T) {
  dir := t.TempDir()
  first, _ := store.LoadPairing(dir)
  _ = store.SavePairing(dir, store.Pairing{Bound: true, Token: first.Token})
  next, err := store.RotateToken(dir)
  if err != nil || next.Bound || next.Token == first.Token {
    t.Fatalf("%+v %v", next, err)
  }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/helper-go && go test ./internal/store/`
Expected: FAIL

- [ ] **Step 4: Implement store + pairing**

Serialize `replicas.json` with `season`/`episode` as JSON numbers or `null` (use `*int`). File mode `0o600` for `pairing.json`.

- [ ] **Step 5: Run tests and make sure they pass**

Run: `cd apps/helper-go && go test ./internal/store/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/helper-go/internal/store
git commit -m "feat(helper-go): persist replicas and pairing.json"
```

---

### Task 4: HTTP server — discover, pair, subscriptions, status, backfill, unpair

**Files:**
- Create: `apps/helper-go/internal/httpx/server.go`
- Create: `apps/helper-go/internal/httpx/server_test.go`

**Interfaces:**
- Consumes: `store.Store`, `store.Pairing`, `protocol.DesiredStateDiff`, `mikan.RssEpisode`
- Produces:

```go
package httpx

type Runtime struct {
  Version          string
  Port             int
  AdvertisedQbit   string
  PairingCode      string
  Token            string // current; mutated by /unpair
  Bound            bool
  Store            *store.Store
  DataDir          string
  OnBackfill       func(bangumiID, subgroupID string, episodes []mikan.RssEpisode) ([]store.Episode, error)
  OnUnpair         func() error // persist rotate + ClearAll; server then swaps Token/Bound
}

func New(rt *Runtime) http.Handler
```

Routes:

| Method | Path | Auth | Body / response |
| --- | --- | --- | --- |
| GET | `/discover` | no | `{ version, bindState: "bound"\|"unbound", advertisedQbitUrl, pairingCode, port }` |
| POST | `/pair` | no | `{ code }` → 403 or `{ token }`. Success sets `Bound=true` via `SavePairing` |
| GET | `/subscriptions` | Bearer | `{ replicas }` |
| PUT | `/subscriptions` | Bearer | `{ replicas }` apply `DesiredStateDiff`, save, return `{ replicas }` |
| GET | `/status` | Bearer | `{ replicas: replica+episodes, jobs }` jobs = episode maps whose key is not covered by a replica (same as TS `statusJobs`) |
| POST | `/backfill` | Bearer | `{ bangumiId, subgroupId, episodes }` → `{ episodes }` |
| POST | `/unpair` | Bearer | `{ ok: true }`; `bound=false`, rotate token, `ClearAll` |

Unauthorized authenticated routes: `401 { error: "unauthorized" }`. Compare bearer with `crypto/subtle.ConstantTimeCompare` on equal-length buffers (if lengths differ, 401). Pairing code compare the same way.

`bindState` on `/discover` is `Runtime.Bound` which must be loaded from disk at process start (Task 8) and updated on pair/unpair.

- [ ] **Step 1: Write failing HTTP tests** using `httptest.NewServer`

Cover at least:

1. `GET /discover` unauthenticated, `bindState=unbound`, returns code/version/port/qbit URL
2. `POST /pair` wrong code → 403, bound unchanged
3. `POST /pair` right code → `{ token }`; second pair with same code returns the same token; `/discover` now `bound`
4. `GET /subscriptions` without bearer → 401
5. `PUT /subscriptions` applies diff (add then remove extra)
6. `GET /status` includes replica episodes; leftover episode maps appear under `jobs`
7. `POST /backfill` invokes callback and returns its episodes
8. `POST /unpair` → 200; old token 401; `/discover` `unbound`; store empty; new pair returns the rotated token

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/helper-go && go test ./internal/httpx/`
Expected: FAIL

- [ ] **Step 3: Implement `New` with `http.NewServeMux`**

Keep `server.go` under 300 lines. If it grows, split `readJSON` / `authorize` into `internal/httpx/util.go`.

`OnUnpair` default: `RotateToken` + `Store.ClearAll` + update `Runtime.Token` and `Runtime.Bound`.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `cd apps/helper-go && go test ./internal/httpx/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/helper-go/internal/httpx
git commit -m "feat(helper-go): serve discover, pair, subscriptions, status, backfill, unpair"
```

---

### Task 5: qBittorrent client, rename planner, download loop

**Files:**
- Create: `apps/helper-go/internal/qb/client.go`
- Create: `apps/helper-go/internal/qb/client_test.go`
- Create: `apps/helper-go/internal/rename/rename.go`
- Create: `apps/helper-go/internal/rename/rename_test.go`
- Create: `apps/helper-go/internal/loop/loop.go`
- Create: `apps/helper-go/internal/loop/loop_test.go`
- Read-only reference: `apps/helper/src/{qb,rename,loop}.ts` and their tests

**Interfaces:**
- Consumes: `store.Store`, `protocol.Replica`, `mikan.ParseBangumiRSS`, `mikan.ParseMikanTitle`
- Produces:

```go
package qb

type Torrent struct {
  Hash, Name, State, Category, Tags string
  Progress float64
}
type File struct{ Name string; Size int64 }
type AddRequest struct{ URLs, SavePath, Category, Tags, Rename string }

type Client interface {
  ListTorrents() ([]Torrent, error)
  AddTorrent(AddRequest) (hash string, err error)
  ListFiles(hash string) ([]File, error)
  RenameFile(hash, oldPath, newPath string) error
}

func ExtractTorrentInfohash(url string) string
func NewClient(baseURL, user, pass string, fetch ... ) Client

package rename

func FormatEpisodeName(title string, season, episode int) string
func FormatSavePath(libraryRoot, title string, season int) string
func PlanEpisodeRenames(displayName string, files []qb.File) []struct{ From, To string }

package loop

const BangumiCategory = "Bangumi"
func MikanTag(subscriptionID string) string // "tv-mikan:"+id

type Deps struct {
  Store        *store.Store
  FetchRSS     func(url string) (string, error)
  QB           qb.Client
  LibraryRoot  string
  Category     string // default BangumiCategory
  ResolveTitle func(replica protocol.Replica, item mikan.RssEpisode, parsed mikan.ParsedTitle) mikan.ParsedTitle
}

func Tick(deps Deps) error
func Backfill(deps Deps, bangumiID, subgroupID string, items []mikan.RssEpisode) ([]store.Episode, error)
func Start(deps Deps, interval time.Duration) (stop func())
```

`ResolveTitle` is a hook so Task 7 can inject Bangumi without changing Tick’s control flow. Default (nil) returns `parsed` unchanged.

Loop rules (port `apps/helper/src/loop.ts`):

- Dedupe on episode id and infohash; skip if that hash is already in qBit (do not record a row).
- If `parsed.Episode == nil` after `ResolveTitle` → `needs-manual`, do not add.
- Add with `savepath=FormatSavePath`, `category`, `tags=MikanTag(replica.ID)`, `rename=FormatEpisodeName`. Season defaults to 1 when parsed season is nil but episode is set.
- Add error → `failed` + `lastError`.
- Completion: `progress >= 1` or state matches `uploading|pausedUP|stoppedUP|stalledUP|queuedUP|forcedUP|checkingUP`.
- Before rename API: set `renaming`. Success `done` (drop lastError). Failure `failed`, keep torrent; next tick retries (`failed` is not skipped in `syncCompleted`).
- Skip `needs-manual` and `done` and nil episode/season in `syncCompleted`.
- Serialize Tick/Backfill per store (mutex).

Rename: port `apps/helper/src/rename.ts` (video ext set, sub ext set, skip sample/ncop/nced, largest video, matching sub stem + language suffix).

qBit HTTP: port `apps/helper/src/qb.ts` (`/api/v2/auth/login`, cookie SID, 403 retry, `Fails.` on add). Inject `http.Client` or a `Do` func for tests.

- [ ] **Step 1: Write failing rename tests** (port `apps/helper/src/rename.test.ts` cases: format name, save path with and without libraryRoot, video+cht.ass, skip Sample)

- [ ] **Step 2: Write failing qb tests**

Fake an `http.RoundTripper`. Cover: login SID cookie; add `Fails.` is an error; `extractTorrentInfohash` from a `.torrent` URL.

- [ ] **Step 3: Write failing loop tests** (port these named behaviors from `apps/helper/src/loop.test.ts`)

1. New RSS item adds with save path `/library/{title}/Season 01` and display name `{title} - S01E28`
2. Same episode id is not added twice
3. Same infohash already in qBit → no add and no episode row
4. Collection title → `needs-manual`, no add
5. `S02E07` uses Season 02
6. On complete, rename video + matching sub, skip Sample, state `done`
7. Failed rename stays `failed`, torrent kept, next tick retries to `done`
8. During rename (inject a qb that blocks until asserted) state is `renaming` — if hard to observe mid-call, assert the client saw `RenameFile` only after the in-memory state was set by checking a probe callback, or split `syncCompleted` and unit-test that it writes `renaming` before the first `RenameFile`
9. Backfill uses the same dedupe / needs-manual / add rules
10. RSS skip of already-`failed` ids (no second add)

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd apps/helper-go && go test ./internal/rename/ ./internal/qb/ ./internal/loop/`
Expected: FAIL

- [ ] **Step 5: Implement rename, qb, loop**

Default `Category` to `Bangumi` when empty. `Backfill` may use a synthetic replica when no replica row exists (same as TS `syntheticReplica`).

- [ ] **Step 6: Run tests and make sure they pass**

Run: `cd apps/helper-go && go test ./internal/rename/ ./internal/qb/ ./internal/loop/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/helper-go/internal/qb apps/helper-go/internal/rename apps/helper-go/internal/loop
git commit -m "feat(helper-go): add torrents and rename on completion"
```

---

### Task 6: Config overlay and GET/PUT /config

**Files:**
- Create: `apps/helper-go/internal/config/config.go`
- Create: `apps/helper-go/internal/config/config_test.go`
- Modify: `apps/helper-go/internal/httpx/server.go`
- Modify: `apps/helper-go/internal/httpx/server_test.go`

**Interfaces:**
- Consumes: Task 4 `Runtime`
- Produces:

```go
package config

type File struct {
  LibraryRoot    string `json:"libraryRoot"`
  Category       string `json:"category"`
  QbitURL        string `json:"qbitUrl"`
  QbitUser       string `json:"qbitUser"`
  QbitPass       string `json:"qbitPass"`
  PollIntervalMs int    `json:"pollIntervalMs"`
}

func DefaultsFromEnv(env map[string]string) File // missing env → LIBRARY_ROOT "", QBIT_URL http://127.0.0.1:8080, QBIT_USER admin, QBIT_PASS "", POLL_INTERVAL_MS 600000, Category "Bangumi"
func Load(dataDir string, base File) (File, error) // overlay $DATA_DIR/config.json
func Save(dataDir string, file File) error

type Public struct {
  LibraryRoot    string `json:"libraryRoot"`
  Category       string `json:"category"`
  QbitURL        string `json:"qbitUrl"`
  QbitUser       string `json:"qbitUser"`
  HasQbitPass    bool   `json:"hasQbitPass"`
  PollIntervalMs int    `json:"pollIntervalMs"`
}

func (f File) Public() Public
```

HTTP:

- `GET /config` Bearer → `Public` (never password)
- `PUT /config` Bearer, partial JSON. Empty `category` → `400`. If `qbitUrl` / `qbitUser` / `qbitPass` change, call `Runtime.ProbeQbit(url,user,pass)`; failure `400` and do not write. Success: `Save` overlay, `Runtime.ApplyConfig(File)`.

```go
// add to httpx.Runtime
ProbeQbit   func(url, user, pass string) error
ApplyConfig func(config.File)
Current     func() config.File
```

`ApplyConfig` is implemented in Task 8 (swap qb client, libraryRoot, category, restart ticker). Tests inject recorders.

- [ ] **Step 1: Write failing config package tests**

```go
func TestOverlayWinsOverEnv(t *testing.T) {
  dir := t.TempDir()
  _ = config.Save(dir, config.File{LibraryRoot: "/from-file", Category: "Bangumi", QbitURL: "http://qb", QbitUser: "u", PollIntervalMs: 1000})
  base := config.DefaultsFromEnv(map[string]string{"LIBRARY_ROOT": "/from-env", "QBIT_URL": "http://env"})
  got, err := config.Load(dir, base)
  if err != nil || got.LibraryRoot != "/from-file" {
    t.Fatalf("%+v %v", got, err)
  }
}

func TestPublicOmitsPassword(t *testing.T) {
  p := config.File{QbitPass: "secret", QbitUser: "u"}.Public()
  if !p.HasQbitPass || p.QbitUser != "u" {
    t.Fatalf("%+v", p)
  }
  raw, _ := json.Marshal(p)
  if bytes.Contains(raw, []byte("secret")) || bytes.Contains(raw, []byte("qbitPass")) {
    t.Fatalf("%s", raw)
  }
}
```

- [ ] **Step 2: Write failing HTTP tests**

1. GET `/config` 401 without token
2. GET returns overlay values + `hasQbitPass`
3. PUT `{ "libraryRoot": "/tv" }` persists and `ApplyConfig` sees it
4. PUT `{ "category": "" }` → 400, overlay unchanged
5. PUT new `qbitUrl` when `ProbeQbit` errors → 400, `ApplyConfig` not called
6. PUT `{ "qbitPass": "" }` keeps previous password

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/helper-go && go test ./internal/config/ ./internal/httpx/`
Expected: FAIL

- [ ] **Step 4: Implement overlay + routes**

Partial PUT: decode into a `map[string]json.RawMessage` or a struct of pointers. Unspecified fields keep `Current()`.

- [ ] **Step 5: Run tests and make sure they pass**

Run: `cd apps/helper-go && go test ./internal/config/ ./internal/httpx/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/helper-go/internal/config apps/helper-go/internal/httpx
git commit -m "feat(helper-go): expose GET/PUT /config overlay"
```

---

### Task 7: Bangumi fallback and POST /retry

**Files:**
- Create: `apps/helper-go/internal/bangumi/client.go`
- Create: `apps/helper-go/internal/bangumi/client_test.go`
- Modify: `apps/helper-go/internal/loop/loop.go`
- Modify: `apps/helper-go/internal/loop/loop_test.go`
- Modify: `apps/helper-go/internal/httpx/server.go`
- Modify: `apps/helper-go/internal/httpx/server_test.go`

**Interfaces:**
- Consumes: Task 5 `ResolveTitle`, Task 4 handler
- Produces:

```go
package bangumi

type Episode struct {
  Sort    float64
  AirDate string // YYYY-MM-DD
  Name    string
}

type Client struct{}

func New(fetch func(url string) ([]byte, error)) *Client
func (c *Client) Episodes(subjectID string) ([]Episode, error)
func Match(parsed mikan.ParsedTitle, item mikan.RssEpisode, episodes []Episode) mikan.ParsedTitle
```

`Episodes` GETs `https://api.bgm.tv/v0/episodes?subject_id={id}&type=0&limit=100` (User-Agent `torrent-vibe-helper/0.0.1`). Cache by subjectID for 1 hour in process. Fetch error → return error; `Match` is not called.

`Match` accepts **exactly one** hit:

- `item.PublishedAt` parses to a time whose UTC date is within 1 day of `AirDate`, or
- the Mikan title contains that episode’s integer `Sort` as a standalone number (already the parse path — use this when parse got nothing but airdate unique-matches)

If zero or two+ airdate hits → return parsed unchanged (still missing episode). Never invent `S00E00`.

`ResolveTitle` in loop:

```
if parsed.Episode != nil { return parsed }
if replica.BangumiSubjectID == "" { return parsed }
eps, err := bangumi.Episodes(...)
if err != nil { return parsed }
return Match(parsed, item, eps)
```

`POST /retry` Bearer body `{ bangumiId, subgroupId, episodeId }`:

- Find episode in that map key
- If missing → 404
- If state not `failed` or `needs-manual` → 400
- Reset to `pending`, clear `infohash` and `lastError`
- Run ingest for that single item if the client sends no torrent URL: **reload from current replica RSS is not required**. Body must also accept optional `title` + `torrentUrl` when present; if absent, reconstruct from the stored episode `title` and skip add unless a `torrentUrl` is provided.

Wire-level decision (lock this): request body is

```json
{ "bangumiId": "...", "subgroupId": "...", "episodeId": "...", "title": "...", "torrentUrl": "..." }
```

`title` and `torrentUrl` are required so ingest can run immediately without a live RSS fetch. Electron already has them on the status row (`title`) and can pass `torrentUrl` from the bangumi page; from 我的订阅, pass stored `title` and omit `torrentUrl` only if `infohash` can rebuild a Mikan download URL — **do not invent**. If `torrentUrl` is empty, `/retry` still resets state to `pending` and returns 200 `{ episodes }`; the next Tick will skip the id (already recorded as pending) — **wrong**.

Correct rule: `/retry` deletes that episode row, then if `torrentUrl` is present runs `Backfill`/`ingest` for that one item; if `torrentUrl` is absent, delete the row only so the next RSS tick can re-add. Electron 我的订阅 retry (no URL) uses delete-row. Bangumi page retry (has torrent URL) sends it.

- [ ] **Step 1: Write failing Bangumi tests**

```go
func TestMatchUniqueAirdate(t *testing.T) {
  parsed := mikan.ParsedTitle{Title: "X"}
  item := mikan.RssEpisode{PublishedAt: "2024-03-22T12:00:00Z"}
  got := bangumi.Match(parsed, item, []bangumi.Episode{
    {Sort: 28, AirDate: "2024-03-22", Name: "e28"},
    {Sort: 27, AirDate: "2024-03-15", Name: "e27"},
  })
  if got.Episode == nil || *got.Episode != 28 {
    t.Fatalf("%+v", got)
  }
}

func TestMatchPackDoesNotUniqueMatch(t *testing.T) {
  parsed := mikan.ParsedTitle{Title: "X"}
  item := mikan.RssEpisode{PublishedAt: "2024-03-22T12:00:00Z"}
  got := bangumi.Match(parsed, item, []bangumi.Episode{
    {Sort: 1, AirDate: "2024-03-22"},
    {Sort: 2, AirDate: "2024-03-22"},
  })
  if got.Episode != nil {
    t.Fatalf("%+v", got)
  }
}

func TestEpisodesCachesBySubject(t *testing.T) {
  hits := 0
  c := bangumi.New(func(url string) ([]byte, error) {
    hits++
    return []byte(`{"data":[{"sort":1,"airdate":"2024-01-01","name":"a"}]}`), nil
  })
  _, _ = c.Episodes("123")
  _, _ = c.Episodes("123")
  if hits != 1 {
    t.Fatalf("hits=%d", hits)
  }
}
```

- [ ] **Step 2: Write failing loop + HTTP retry tests**

1. Replica with `bangumiSubjectID` and unparseable-but-airdate-unique RSS item is added as that episode (inject Bangumi client)
2. Missing subject id never calls Bangumi
3. Bangumi fetch error → `needs-manual`, subscription stays
4. `POST /retry` on `failed` with `torrentUrl` calls ingest again
5. `POST /retry` on `done` → 400
6. `POST /retry` without `torrentUrl` deletes the row so a later Tick can add

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/helper-go && go test ./internal/bangumi/ ./internal/loop/ ./internal/httpx/`
Expected: FAIL

- [ ] **Step 4: Implement client, Match, ResolveTitle wiring, `/retry`**

- [ ] **Step 5: Run tests and make sure they pass**

Run: `cd apps/helper-go && go test ./...`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/helper-go/internal/bangumi apps/helper-go/internal/loop apps/helper-go/internal/httpx
git commit -m "feat(helper-go): resolve episodes via Bangumi and POST /retry"
```

---

### Task 8: `torrent-vibe-helper` command

**Files:**
- Create: `apps/helper-go/cmd/torrent-vibe-helper/main.go`
- Create: `apps/helper-go/internal/mdns/advertise.go`
- Create: `apps/helper-go/Dockerfile`

**Interfaces:**
- Consumes: all previous packages
- Produces: a binary that listens, prints the pairing code, follows replicas

`main.go` behavior:

1. Parse flags (`-port`, `-data-dir`, `-library-root`, `-qbit-url`, `-qbit-user`, `-qbit-pass`, `-poll-interval`) with env fallbacks matching `config.DefaultsFromEnv`.
2. `pairing := store.LoadPairing(dataDir)`
3. `cfg := config.Load(dataDir, baseFromFlags)`
4. Generate pairing code with alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (6 chars).
5. Build `qb.NewClient(cfg.QbitURL, cfg.QbitUser, cfg.QbitPass)`
6. `loop.Start` with `ResolveTitle` wired to Bangumi
7. `httpx.New` with `OnBackfill`, `OnUnpair`, `ProbeQbit` = login attempt, `ApplyConfig` = swap qb client + libraryRoot + category + restart ticker + persist already done by HTTP
8. Listen `:{port}`
9. Unless `MIKAN_HELPER_DISABLE_MDNS=1`, advertise `_torrentvibe-helper._tcp` (use `github.com/grandcat/zeroconf` or `github.com/hashicorp/mdns`; instance name `torrent-vibe-helper-<hostname>`, txt `version`)
10. Print:

```
[helper] listening on :17890
[helper] pairing code: ABC234
[helper] advertised qBittorrent: http://127.0.0.1:8080
```

11. SIGINT/SIGTERM: stop loop, stop mDNS, close server

Dockerfile:

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY apps/helper-go ./
RUN CGO_ENABLED=0 go build -o /torrent-vibe-helper ./cmd/torrent-vibe-helper

FROM scratch
COPY --from=build /torrent-vibe-helper /torrent-vibe-helper
EXPOSE 17890
ENTRYPOINT ["/torrent-vibe-helper"]
```

Build context: `apps/helper-go` (not repo root). Document that in `apps/helper-go/README.md` (short: flags, pairing, Docker).

- [ ] **Step 1: Write a smoke test for pairing-code alphabet**

Put `GeneratePairingCode()` in `internal/store` or `internal/httpx` and test: length 6, only alphabet chars, not empty.

- [ ] **Step 2: Run the new test (fail), implement generator, pass**

- [ ] **Step 3: Write `main.go` + mDNS advertise + Dockerfile + README**

Keep `main.go` as wiring only. Live apply in `ApplyConfig` must be mutex-safe with `Tick`.

- [ ] **Step 4: Compile**

Run: `cd apps/helper-go && go build -o /tmp/torrent-vibe-helper ./cmd/torrent-vibe-helper`
Expected: success

- [ ] **Step 5: Commit**

```bash
git add apps/helper-go/cmd apps/helper-go/internal/mdns apps/helper-go/Dockerfile apps/helper-go/README.md apps/helper-go/go.sum
git commit -m "feat(helper-go): add torrent-vibe-helper command"
```

---

### Task 9: Publish linux binaries on desktop release

**Files:**
- Modify: `.github/workflows/desktop-release.yml`

**Interfaces:**
- Consumes: Task 8 `cmd/torrent-vibe-helper`
- Produces: release assets

```
torrent-vibe-helper_<version>_linux_amd64
torrent-vibe-helper_<version>_linux_arm64
SHA256SUMS-helper
```

`version` is `needs.release-mac.outputs.version` (same as the desktop tag without `desktop-v`).

- [ ] **Step 1: Add job `release-helper` after `release-mac` exists**

Mirror the linux job’s `needs: release-mac` and `permissions: contents: write`. Steps:

1. `actions/checkout@v4` at the release ref
2. `actions/setup-go@v5` with `go-version: '1.23'`
3. Build:

```bash
cd apps/helper-go
VERSION="${{ needs.release-mac.outputs.version }}"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "-s -w" \
  -o "torrent-vibe-helper_${VERSION}_linux_amd64" ./cmd/torrent-vibe-helper
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags "-s -w" \
  -o "torrent-vibe-helper_${VERSION}_linux_arm64" ./cmd/torrent-vibe-helper
shasum -a 256 torrent-vibe-helper_${VERSION}_linux_* > SHA256SUMS-helper
```

4. Upload like the linux job:

```bash
TAG="${{ needs.release-mac.outputs.tag }}"
gh release upload "$TAG" --repo "$REPO_SLUG" --clobber \
  apps/helper-go/torrent-vibe-helper_${VERSION}_linux_amd64 \
  apps/helper-go/torrent-vibe-helper_${VERSION}_linux_arm64 \
  apps/helper-go/SHA256SUMS-helper
```

Do not change mac/windows packaging.

- [ ] **Step 2: Sanity-check YAML locally**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/desktop-release.yml'))"`
Expected: success (if PyYAML missing, `node -e "require('fs').readFileSync('.github/workflows/desktop-release.yml')"` and visually confirm `needs: release-mac` + `gh release upload`)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/desktop-release.yml
git commit -m "ci: attach helper linux binaries to desktop releases"
```

---

### Task 10: Electron helper client — unpair, uniqueness, config, retry

**Files:**
- Modify: `layer/renderer/src/modules/helper-client/types.ts`
- Modify: `layer/renderer/src/modules/helper-client/api.ts`
- Modify: `layer/renderer/src/modules/helper-client/bindings.ts`
- Modify: `layer/renderer/src/modules/helper-client/bindings.test.ts`
- Modify: `layer/renderer/src/modules/helper-client/index.ts`
- Create: `layer/renderer/src/modules/helper-client/install-command.ts`
- Create: `layer/renderer/src/modules/helper-client/install-command.test.ts`
- Modify: `layer/renderer/src/modules/subscriptions/actions.ts`
- Modify: `layer/renderer/src/modules/subscriptions/actions.test.ts`

**Interfaces:**
- Consumes: helper HTTP from Tasks 4–7
- Produces:

```ts
export interface HelperConfigPublic {
  libraryRoot: string
  category: string
  qbitUrl: string
  qbitUser: string
  hasQbitPass: boolean
  pollIntervalMs: number
}

export type HelperConfigPatch = Partial<{
  libraryRoot: string
  category: string
  qbitUrl: string
  qbitUser: string
  qbitPass: string
  pollIntervalMs: number
}>

export const unpairHelper = (baseUrl: string, token: string) =>
  request(baseUrl, '/unpair', { method: 'POST' }, token)

export const getHelperConfig = (baseUrl: string, token: string) =>
  request(baseUrl, '/config', { method: 'GET' }, token) // parse HelperConfigPublic

export const putHelperConfig = (
  baseUrl: string,
  token: string,
  patch: HelperConfigPatch,
) => request(baseUrl, '/config', { method: 'PUT', body: JSON.stringify(patch) }, token)

export const retryHelperEpisode = (
  baseUrl: string,
  token: string,
  input: {
    bangumiId: string
    subgroupId: string
    episodeId: string
    title?: string
    torrentUrl?: string
  },
) => request(baseUrl, '/retry', { method: 'POST', body: JSON.stringify(input) }, token)

export const normalizeHelperBaseUrl = (url: string) => url.trim().replace(/\/+$/, '')

export const ownerOfHelperUrl = (
  url: string,
  bindings: Record<string, HelperBinding>,
  exceptServerId?: string,
): string | null

export const helperInstallCommand = (input: {
  arch: 'amd64' | 'arm64'
  repoSlug?: string // default Torrent-Vibe/Torrent-Vibe
}) => string
```

`ownerOfHelperUrl`: compare `normalizeHelperBaseUrl`. Return the other `serverId` or `null`.

`setHelperBinding`: if `ownerOfHelperUrl(url, bindings, serverId)` is set, throw `Error('helperUrlInUse')` and do not write.

`helperInstallCommand` must produce:

```bash
curl -fsSL -o torrent-vibe-helper \
  "https://github.com/Torrent-Vibe/Torrent-Vibe/releases/latest/download/torrent-vibe-helper_linux_amd64"
chmod +x torrent-vibe-helper
sudo mv torrent-vibe-helper /usr/local/bin/torrent-vibe-helper
torrent-vibe-helper
```

(`arm64` swaps the asset name.)

`SubscriptionActions`:

- `unbindHelper(serverId)`: best-effort `unpairHelper`, always `clearHelperBinding`, delete `statusByServer[serverId]`, **keep** `targetServerIds`. Auth errors still `clearHelperBinding`.
- `forgetServer`: best-effort `unpairHelper` then existing strip-targets logic.
- `retryEpisode({ serverId, bangumiId, subgroupId, episodeId, title?, torrentUrl? })`: call `retryHelperEpisode`, then `refreshStatus([serverId])`.
- Pairing panel will call `unbindHelper` instead of `clearHelperBinding`.

- [ ] **Step 1: Write failing tests**

`bindings.test.ts`:

```ts
it('rejects pairing a helper URL already owned by another server', () => {
  setHelperBinding('srv-a', { url: 'http://nas:17890', token: 'a' })
  expect(() =>
    setHelperBinding('srv-b', { url: 'http://nas:17890/', token: 'b' }),
  ).toThrow('helperUrlInUse')
  expect(getHelperBinding('srv-b')).toBeNull()
})

it('allows rebind of the same server id', () => {
  setHelperBinding('srv-a', { url: 'http://nas:17890', token: 'a' })
  setHelperBinding('srv-a', { url: 'http://nas:17890', token: 'a2' })
  expect(getHelperBinding('srv-a')?.token).toBe('a2')
})
```

`install-command.test.ts`: amd64 URL contains `torrent-vibe-helper_linux_amd64`; arm64 contains `linux_arm64`; command includes `chmod +x` and `torrent-vibe-helper` as the last line.

`actions.test.ts` (extend `createFakeHelper` with `unpairs: string[]` and optional `retry`):

1. `unbindHelper('srv-a')` calls unpair, clears binding, **leaves** `targetServerIds` containing `srv-a`
2. Unreachable unpair still clears local binding
3. `forgetServer` unpairs then strips targets (existing assert + `unpairs`)
4. `retryEpisode` posts and refreshes

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run layer/renderer/src/modules/helper-client layer/renderer/src/modules/subscriptions/actions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement API, uniqueness, actions, install-command**

On `helperUrlInUse`, do not write storage.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `pnpm exec vitest run layer/renderer/src/modules/helper-client layer/renderer/src/modules/subscriptions/actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add layer/renderer/src/modules/helper-client layer/renderer/src/modules/subscriptions
git commit -m "feat(helper-client): unpair, unique URLs, config and retry APIs"
```

---

### Task 11: Pairing UI, mDNS browse, config fields, retry controls

**Files:**
- Create: `layer/main/src/ipc/helper-mdns.service.ts`
- Modify: `layer/main/src/ipc/services.ts` (register the service)
- Modify: `layer/main/package.json` (add `bonjour-service`)
- Create: `layer/renderer/src/modules/helper-client/HelperInstallSnippet.tsx`
- Create: `layer/renderer/src/modules/helper-client/HelperConfigForm.tsx`
- Create: `layer/renderer/src/modules/helper-client/HelperMdnsList.tsx`
- Modify: `layer/renderer/src/modules/helper-client/HelperPairingPanel.tsx`
- Modify: `layer/renderer/src/modules/modals/DiscoverModal/mikan/MikanSubscriptionsTab.tsx`
- Modify: `layer/renderer/src/modules/modals/DiscoverModal/mikan/MikanBangumiPage.tsx`
- Modify: `locales/app/en.json`
- Modify: `locales/app/zh-CN.json`

**Interfaces:**
- Consumes: Task 10 client APIs; `ipcServices.helperMdns`
- Produces: UI only

```ts
// layer/main/src/ipc/helper-mdns.service.ts
export class HelperMdnsService extends IpcService {
  static override readonly groupName = 'helperMdns'
  startBrowse(): void
  stopBrowse(): void
  list(): Array<{ name: string; host: string; port: number; version: string }>
}
```

Browse type `torrentvibe-helper` over TCP (bonjour-service: `{ type: 'torrentvibe-helper', protocol: 'tcp' }`). `list()` returns the current snapshot. Renderer polls every 2s while the pairing panel is mounted; `useEffect` start on mount, stop on unmount. Web: `ipcServices?.helperMdns` is null — hide the list and the install snippet (`ELECTRON` guard).

`HelperPairingPanel` order (spec §8):

1. `HelperInstallSnippet` when unbound (arch toggle amd64/arm64, copy button)
2. Same-host probe
3. `HelperMdnsList` (Electron only). Disable a row whose URL `ownerOfHelperUrl` is another server; show that server’s name. Click fills `manualUrl` only
4. Manual URL
5. Pairing code (never prefilled from `/discover`)
6. After paired: `HelperConfigForm` (`GET` on mount, `PUT` on save; empty password = omit field)

Unbind button calls `SubscriptionActions.shared.unbindHelper(serverId)`. If the action reports unreachable unpair, toast `servers.helper.unbindLocalOnly`.

`setHelperBinding` errors: toast `servers.helper.urlInUse` with the owner name.

i18n keys (add to **both** `en.json` and `zh-CN.json`; do not create a parent key that collides with a child):

| Key | en |
| --- | --- |
| `servers.helper.installTitle` | Install on the download host |
| `servers.helper.installCopy` | Copy command |
| `servers.helper.installCopied` | Copied |
| `servers.helper.archAmd64` | Linux x64 |
| `servers.helper.archArm64` | Linux ARM64 |
| `servers.helper.mdnsTitle` | Helpers on this LAN |
| `servers.helper.mdnsEmpty` | None found |
| `servers.helper.mdnsBoundOther` | Bound to {{name}} |
| `servers.helper.urlInUse` | Already paired with {{name}} |
| `servers.helper.unbindLocalOnly` | Unbound here. The helper may still be running. |
| `servers.helper.configTitle` | Helper settings |
| `servers.helper.libraryRoot` | Library root |
| `servers.helper.libraryRootHint` | Path the helper process sees |
| `servers.helper.category` | Category |
| `servers.helper.qbitUrl` | Helper qBittorrent URL |
| `servers.helper.qbitUser` | qBittorrent user |
| `servers.helper.qbitPass` | qBittorrent password |
| `servers.helper.saveConfig` | Save |
| `servers.helper.configSaved` | Helper settings saved |
| `servers.helper.configSaveFailed` | Could not save helper settings |
| `discover.modal.mikan.retry` | Retry |

Retry: on 我的订阅, if `latest?.state` is `failed` or `needs-manual`, show a Retry button that calls `retryEpisode` without `torrentUrl`. On the bangumi page episode row, same states with `torrentUrl` from the episode.

Keep each new component under 300 lines. `HelperPairingPanel` should only compose children.

- [ ] **Step 1: Write a failing install-snippet / uniqueness UI-adjacent unit test if needed**

`ownerOfHelperUrl` is already tested. Add `HelperMdnsList` logic as a pure function if list filtering is non-trivial:

```ts
export const decorateMdnsRows = (
  rows: Array<{ host: string; port: number }>,
  bindings: Record<string, HelperBinding>,
  currentServerId: string,
  serverNames: Record<string, string>,
) => rows.map(...)
```

Test: same URL as another server → `disabled: true`, `ownerName` set.

- [ ] **Step 2: Run that test (fail), implement decorator (pass)**

- [ ] **Step 3: Implement IPC service, panel children, i18n, retry buttons**

`pnpm` add `bonjour-service` **only** to `layer/main`. After install, lockfile update is part of this commit.

- [ ] **Step 4: Typecheck / lint touched files**

Run: `pnpm exec eslint layer/renderer/src/modules/helper-client layer/renderer/src/modules/modals/DiscoverModal/mikan/MikanSubscriptionsTab.tsx layer/renderer/src/modules/modals/DiscoverModal/mikan/MikanBangumiPage.tsx layer/main/src/ipc/helper-mdns.service.ts layer/main/src/ipc/services.ts locales/app/en.json locales/app/zh-CN.json`
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add layer/main/src/ipc/helper-mdns.service.ts layer/main/src/ipc/services.ts layer/main/package.json pnpm-lock.yaml \
  layer/renderer/src/modules/helper-client layer/renderer/src/modules/modals/DiscoverModal/mikan \
  locales/app/en.json locales/app/zh-CN.json
git commit -m "feat(helper): pairing install snippet, mDNS list, config form, retry"
```

---

### Task 12: Delete the TypeScript helper

**Files:**
- Delete: `apps/helper/` (entire package)
- Modify: `pnpm-workspace.yaml` only if it lists `apps/helper` explicitly (workspace is `apps/*` / `packages/*` — removing the folder is enough)
- Modify: `apps/helper/README.md` is deleted; keep `apps/helper-go/README.md` as the only helper readme
- Search and update leftover references:

Run: `rg -n "apps/helper|@torrent-vibe/helper" --glob '!apps/helper-go/**' --glob '!docs/superpowers/**'`

Update any remaining package.json workspace dependency or CI filter. Do **not** delete `packages/helper-protocol` or `packages/mikan`.

- [ ] **Step 1: Confirm Go tests still pass**

Run: `cd apps/helper-go && go test ./...`
Expected: PASS

- [ ] **Step 2: Delete `apps/helper` and fix broken references**

- [ ] **Step 3: Ensure renderer/helper-protocol tests still pass**

Run: `pnpm exec vitest run packages/helper-protocol packages/mikan layer/renderer/src/modules/helper-client layer/renderer/src/modules/subscriptions`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A apps/helper pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "chore(helper): remove TypeScript daemon"
```

---

## Self-review

Spec coverage:

| Spec section | Task |
| --- | --- |
| Go daemon replaces TS | 1–8, 12 |
| Install command + release assets | 9, 10 (`helperInstallCommand`), 11 (snippet) |
| Optional scratch Docker | 8 |
| Cardinality / URL uniqueness | 10, 11 |
| pairing.json + migrate token unbound | 3 |
| `/pair` `/unpair` | 4, 10, 11 |
| Unbind keeps targets; forgetServer strips | 10 |
| Config overlay + GET/PUT + probe | 6, 8, 11 |
| mDNS advertise + Electron browse | 8, 11 |
| Web: no mDNS, no install command | 11 `ELECTRON` guard |
| Bangumi unique match + 1h cache | 7 |
| `renaming` + failed rename retry | 5 |
| `/retry` | 7, 10, 11 |
| No auto-fill pairing code | 11 |
| Delete TS helper last | 12 |
