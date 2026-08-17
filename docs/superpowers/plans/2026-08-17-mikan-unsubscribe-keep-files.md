# Mikan Unsubscribe File Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unsubscribing a Mikan show stops following and removes that subscription’s torrents from each target qBittorrent, with a checkbox for whether local files stay.

**Architecture:** Electron still PUTs the remaining replica set. Unsubscribe adds `removeTorrents` + `deleteFiles` on that PUT. The helper deletes by episode infohash via local qBittorrent. Old helpers ignore the fields; Electron then deletes leftover `/status` jobs through that server’s qBittorrent client. UI is one shared confirm (same shape as `DeleteTorrentPrompt`).

**Tech Stack:** Go helper (`apps/helper-go`), Vitest renderer tests, React + existing `Prompt` / `Checkbox`, i18n `locales/app/{en,zh-CN}.json`.

## Global Constraints

- Zero comments / JSDoc in business code.
- TDD: failing test first for every new behavior.
- Do not send `removeTorrents` on subscribe, non-empty retarget, sync, unpair, or forgetServer.
- Default keep files (`deleteFiles: false`).
- Never restore a dropped subscription because delete failed.
- Only lint/typecheck files you change.
- Do not commit unless the user asks.

---

### Task 1: Helper qBittorrent delete

**Files:**
- Modify: `apps/helper-go/internal/qb/client.go`
- Test: `apps/helper-go/internal/qb/client_test.go`

**Interfaces:**
- Consumes: existing `HTTPClient.request`
- Produces: `func (c *HTTPClient) DeleteTorrents(hashes []string, deleteFiles bool) error`

- [ ] **Step 1: Write the failing test**

In `client_test.go`, extend the transport mock so `/api/v2/torrents/delete` is inspectable, then:

```go
func TestDeleteTorrentsSendsHashesAndFlag(t *testing.T) {
	var gotPath, gotBody string
	client := clientWithDelete(func(r *http.Request) {
		gotPath = r.URL.Path
		raw, _ := io.ReadAll(r.Body)
		gotBody = string(raw)
	})
	if err := client.DeleteTorrents([]string{"aaa", "BBB"}, true); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(gotPath, "/api/v2/torrents/delete") {
		t.Fatal(gotPath)
	}
	if !strings.Contains(gotBody, "hashes=aaa%7Cbbb") && !strings.Contains(gotBody, "hashes=aaa|bbb") {
		t.Fatal(gotBody)
	}
	if !strings.Contains(gotBody, "deleteFiles=true") {
		t.Fatal(gotBody)
	}
}
```

Normalize hashes to lowercase to match `ListTorrents`. Empty `hashes` must be a no-op (no HTTP).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/helper-go && go test ./internal/qb -run TestDeleteTorrentsSendsHashesAndFlag -count=1`

Expected: FAIL — `DeleteTorrents` undefined.

- [ ] **Step 3: Write minimal implementation**

```go
func (c *HTTPClient) DeleteTorrents(hashes []string, deleteFiles bool) error {
	if len(hashes) == 0 {
		return nil
	}
	lower := make([]string, 0, len(hashes))
	for _, hash := range hashes {
		if hash != "" {
			lower = append(lower, strings.ToLower(hash))
		}
	}
	if len(lower) == 0 {
		return nil
	}
	form := url.Values{
		"hashes":      {strings.Join(lower, "|")},
		"deleteFiles": {strconv.FormatBool(deleteFiles)},
	}
	res, err := c.request(http.MethodPost, "/api/v2/torrents/delete", strings.NewReader(form.Encode()), "application/x-www-form-urlencoded", true)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return fmt.Errorf("qBittorrent delete failed: %d", res.StatusCode)
	}
	return nil
}
```

Do **not** add this method to `qb.Client` (loop does not delete). HTTP layer will call it through a Runtime callback.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/helper-go && go test ./internal/qb -count=1`

Expected: PASS

---

### Task 2: Helper PUT drop policy

**Files:**
- Modify: `apps/helper-go/internal/httpx/server.go`
- Modify: `apps/helper-go/cmd/torrent-vibe-helper/main.go`
- Test: `apps/helper-go/internal/httpx/server_test.go`

**Interfaces:**
- Consumes: `HTTPClient.DeleteTorrents`, `store.LoadEpisodes` / `SaveEpisodes`, `protocol.DesiredStateDiff`
- Produces: `Runtime.OnDeleteTorrents func(hashes []string, deleteFiles bool) error`; PUT body fields `removeTorrents` / `deleteFiles`

- [ ] **Step 1: Write the failing tests**

```go
func TestPutRemoveTorrentsDeletesHashes(t *testing.T) {
	var gotHashes []string
	var gotDelete bool
	dir := t.TempDir()
	st := store.New(dir)
	_ = st.SaveReplicas([]protocol.Replica{replica("1"), replica("2")})
	_ = st.SaveEpisodes(map[string][]store.Episode{
		store.EpisodeKey("bgm-1", "sg-1"): {
			{EpisodeID: "e1", Title: "e1", Infohash: "aaa", State: protocol.StateDone},
		},
	})
	rt := &httpx.Runtime{
		Token: token, Store: st, DataDir: dir,
		OnDeleteTorrents: func(hashes []string, deleteFiles bool) error {
			gotHashes = append([]string(nil), hashes...)
			gotDelete = deleteFiles
			return nil
		},
	}
	srv := httptest.NewServer(httpx.New(rt))
	defer srv.Close()
	payload, _ := json.Marshal(map[string]any{
		"replicas":       []protocol.Replica{replica("2")},
		"removeTorrents": true,
		"deleteFiles":    true,
	})
	// PUT, expect 200, replicas == [2], OnDeleteTorrents called with ["aaa"], true
	// episode map for bgm-1:sg-1 gone
}

func TestPutWithoutRemoveTorrentsKeepsEpisodes(t *testing.T) {
	// same setup, PUT only {"replicas":[replica("2")]}
	// OnDeleteTorrents must not run; episode map remains
}

func TestPutRemoveTorrentsKeepsMapOnDeleteError(t *testing.T) {
	// OnDeleteTorrents returns error
	// replica "1" still removed from store
	// episode map still present
}
```

Note `replica()` uses `bgm-1`/`sg-1` for every id — two replicas share one episode key. Use a second replica with a different bangumi/subgroup in the keep-row so removing `"1"` is the only key cleared. Change the fixture:

```go
keep := replica("2")
keep.BangumiID, keep.SubgroupID = "bgm-keep", "sg-keep"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/helper-go && go test ./internal/httpx -run 'TestPutRemoveTorrents|TestPutWithoutRemoveTorrents' -count=1`

Expected: FAIL — extra fields ignored, no delete callback.

- [ ] **Step 3: Implement**

Add on `Runtime`:

```go
OnDeleteTorrents func(hashes []string, deleteFiles bool) error
```

`putSubscriptions` decodes:

```go
var body struct {
	Replicas       []protocol.Replica `json:"replicas"`
	RemoveTorrents bool               `json:"removeTorrents"`
	DeleteFiles    bool               `json:"deleteFiles"`
}
```

If `RemoveTorrents`:

1. `ops := protocol.DesiredStateDiff(body.Replicas, current)`
2. Load episodes.
3. For each `OpRemove`, find the current replica by id, collect non-empty infohashes for `EpisodeKey(bangumi, subgroup)`.
4. If hashes empty: delete that episode key.
5. If hashes non-empty and `OnDeleteTorrents == nil`: leave the map (Electron fallback).
6. If hashes non-empty: call `OnDeleteTorrents(hashes, body.DeleteFiles)`. Success → delete key. Error → keep key. Still drop the replica.
7. `SaveEpisodes` then `SaveReplicas(applyDesired(...))`.

PUT stays `200` even when delete fails.

Wire in `main.go` like `OnBackfill`:

```go
OnDeleteTorrents: func(hashes []string, deleteFiles bool) error {
	mu.Lock()
	cfg := rt.Config
	mu.Unlock()
	return qb.NewClient(cfg.QbitURL, cfg.QbitUser, cfg.QbitPass, nil).DeleteTorrents(hashes, deleteFiles)
},
```

- [ ] **Step 4: Run helper tests**

Run: `cd apps/helper-go && go test ./internal/httpx ./internal/qb -count=1`

Expected: PASS

---

### Task 3: Electron unsubscribe PUT flags

**Files:**
- Modify: `layer/renderer/src/modules/helper-client/api.ts`
- Modify: `layer/renderer/src/modules/subscriptions/actions.ts`
- Test: `layer/renderer/src/modules/subscriptions/actions.test.ts`

**Interfaces:**
- Consumes: existing `HelperSyncClient`
- Produces:

```ts
export interface SubscriptionPushOptions {
  deleteFiles?: boolean
  removeTorrents?: boolean
}

putSubscriptions(
  serverId: string,
  replicas: HelperReplica[],
  options?: SubscriptionPushOptions,
): Promise<void>

unsubscribe(id: string, options?: { deleteFiles?: boolean }): Promise<ActionResult>
```

- [ ] **Step 1: Write the failing tests**

Extend `createFakeHelper` so `puts` records options:

```ts
puts: Array<{
  serverId: string
  replicas: HelperReplica[]
  options?: SubscriptionPushOptions
}>
```

Add:

```ts
it('unsubscribe puts remaining set with removeTorrents and deleteFiles', async () => {
  // subscribe two rows on srv-a as today
  const result = await remove.unsubscribe('drop', { deleteFiles: true })
  expect(result.ok).toBe(true)
  expect(helper.puts).toEqual([
    {
      serverId: 'srv-a',
      replicas: desiredReplicasForServer(subscriptionStore.getState().items, 'srv-a'),
      options: { removeTorrents: true, deleteFiles: true },
    },
  ])
})

it('subscribe and retarget puts omit removeTorrents', async () => {
  // after subscribe and after retarget, every put has options undefined / no removeTorrents
})
```

Update the existing unsubscribe test to assert default `{ removeTorrents: true, deleteFiles: false }`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @torrent-vibe/renderer exec vitest run src/modules/subscriptions/actions.test.ts`

Expected: FAIL — options not forwarded.

- [ ] **Step 3: Implement**

`putHelperSubscriptions` third arg; JSON body includes flags only when `removeTorrents` is true.

`pushServers(serverIds, options?)` forwards options to `putSubscriptions`.

`unsubscribe(id, options?)` calls `pushServers(current.targetServerIds, { removeTorrents: true, deleteFiles: options?.deleteFiles === true })`.

`retarget(id, [])` still calls `unsubscribe(id)` (default keep files).

- [ ] **Step 4: Re-run the renderer subscription tests**

Expected: PASS

---

### Task 4: Electron leftover-job fallback

**Files:**
- Modify: `layer/renderer/src/modules/subscriptions/actions.ts`
- Test: `layer/renderer/src/modules/subscriptions/actions.test.ts`

**Interfaces:**
- Consumes: `refreshStatus`, leftover `statusByServer[id].jobs`
- Produces: `SubscriptionActionDeps.deleteTorrents?: (input: { serverId: string; hashes: string[]; deleteFiles: boolean }) => Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
it('deletes leftover job hashes after unsubscribe when the helper kept the episode map', async () => {
  const deleted: Array<{ serverId: string; hashes: string[]; deleteFiles: boolean }> = []
  // subscribe one row, seed statusByServer with a leftover job after put
  // fake helper putSubscriptions removes replica but refreshStatus is the real store write —
  // inject by setting statusByServer in a custom refresh is hard.
  // Instead: after subscribe, set statusByServer to a job matching bangumi+subgroup with infohash.
  // After unsubscribe PUT, actions.refreshStatus overwrites it.
})
```

`refreshStatus` is not injectable today. Keep fallback inside `unsubscribe` after `pushServers` + `refreshStatus`. To test leftover jobs, extend `createSubscriptionActions` so tests can seed `statusByServer` **after** push by stubbing `getHelperStatus`… that is live-only.

Make fallback testable without HTTP: after `pushServers`, read `statusByServer`. In the test, do not call live `getHelperStatus`. Split: `refreshStatus` already no-ops on unbound servers (writes `error: 'unbound'` and keeps previous replicas/jobs). Bind nothing, pre-seed `statusByServer[srv-a]` with leftover jobs, `refreshStatus` for unbound sets `replicas: []` and **replaces** jobs with `[]`.

Look at unbound branch: it sets `replicas: []`, `jobs: []`. That wipes the seed.

So inject `refreshStatus` is too big. Better: after PUT, if we have a test hook…

Simplest testable design: collect leftover hashes **from a function** `loadLeftoverHashes(serverId, bangumiId, subgroupId)` that reads `statusByServer` after refresh. For tests, add optional `deps.refreshStatus` or call `refreshStatus` then immediately allow tests to… no.

**Do this:** add `deps.status?: (serverId: string) => Promise<HelperStatusResponse>` used only by the leftover path. Live uses `getHelperStatus`. Tests return leftover jobs after put.

Even simpler: `unsubscribe` after `pushServers` calls existing `refreshStatus`. Change unbound write to **preserve** previous jobs? That changes other behavior. Don’t.

Inject:

```ts
deleteTorrents?: (...) => Promise<void>
loadHelperStatus?: (serverId: string) => Promise<HelperStatusResponse | null>
```

Live `loadHelperStatus` = `getHelperStatus` via binding. After each successful PUT in unsubscribe (not every pushServers), for that server call `loadHelperStatus`, collect leftover job hashes for the dropped bangumi+subgroup, `deleteTorrents`.

If `loadHelperStatus` omitted, skip fallback (unit tests that only care about PUT flags).

The leftover test provides both.

- [ ] **Step 2: Run the new test — expect FAIL**

- [ ] **Step 3: Implement leftover path only in `unsubscribe`**, after `pushServers`. Failures in `deleteTorrents` flip the result to `partialSync` even if PUT succeeded.

Live wiring:

```ts
loadHelperStatus: async (serverId) => {
  const binding = getHelperBinding(serverId)
  if (!binding) return null
  return getHelperStatus(binding.url, binding.token)
}
deleteTorrents: liveDeleteTorrents
```

`liveDeleteTorrents`: if `serverId === resolveCurrentServerId()`, `QBittorrentClient.shared.removeTorrent(hashes, deleteFiles)`. Else `QBittorrentClient.create` from `loadMultiServerConfig` + `loadServerPassword`, login, remove.

- [ ] **Step 4: Re-run subscription tests**

Expected: PASS

---

### Task 5: Shared unsubscribe prompt + empty targets

**Files:**
- Create: `layer/renderer/src/modules/modals/DiscoverModal/mikan/UnsubscribePrompt.tsx`
- Modify: `layer/renderer/src/modules/modals/DiscoverModal/mikan/bangumi-actions.ts`
- Modify: `layer/renderer/src/modules/modals/DiscoverModal/mikan/MikanSubscriptionsTab.tsx`
- Modify: `layer/renderer/src/modules/modals/DiscoverModal/mikan/MikanSubscribeTargetsModal.tsx`
- Modify: `locales/app/en.json`
- Modify: `locales/app/zh-CN.json`

**Interfaces:**
- Consumes: `Prompt.prompt`, `SubscriptionActions.unsubscribe`, `toast`
- Produces: `presentBangumiUnsubscribe(subscription, title)` shows checkbox and passes `deleteFiles`

- [ ] **Step 1: i18n**

`zh-CN`:

```json
"discover.modal.mikan.unsubscribeConfirm": "将停止追更「{{title}}」，并从所有目标 qBittorrent 移除已添加的种子。",
"discover.modal.mikan.unsubscribeDeleteFiles": "同时删除本地文件"
```

`en`:

```json
"discover.modal.mikan.unsubscribeConfirm": "Stop following “{{title}}” and remove its torrents from every target qBittorrent?",
"discover.modal.mikan.unsubscribeDeleteFiles": "Also delete local files"
```

Keep `unsubscribe` / `unsubscribeTitle`.

- [ ] **Step 2: UnsubscribePrompt**

Copy `DeleteTorrentPrompt` shape. Default checkbox off. `onConfirm(deleteFiles)`.

`presentBangumiUnsubscribe` uses it, then `unsubscribe(id, { deleteFiles })`, toast.error on `!ok` with `discover.modal.mikan.subscribeFailed` or a dedicated `unsubscribeFailed`. Add `discover.modal.mikan.unsubscribeFailed` (en/zh) so copy is accurate.

- [ ] **Step 3: Wire entries**

`MikanSubscriptionsTab` unsubscribe button calls `presentBangumiUnsubscribe(item, item.title)` — delete the inline `Prompt.prompt`.

Edit targets `onConfirm`: if `serverIds.length === 0`, call `presentBangumiUnsubscribe` and return; else `retarget`.

`MikanSubscribeTargetsModal`: enable confirm when `selected.length === 0`. Button label is `t('discover.modal.mikan.unsubscribe')` when empty, else `t('common.confirm')`.

- [ ] **Step 4: Lint changed TS/JSON only**

Run scoped eslint / typecheck on touched renderer files.

---

### Task 6: Verify

- [ ] `cd apps/helper-go && go test ./internal/qb ./internal/httpx -count=1`
- [ ] `pnpm --filter @torrent-vibe/renderer exec vitest run src/modules/subscriptions/actions.test.ts`
- [ ] If `pnpm dev` is available, open Discover → 我的订阅 → 取消订阅 and confirm the checkbox default is off.

---

## Spec coverage

| Spec section | Task |
| --- | --- |
| §4 UI confirm + three entries | 5 |
| §5 PUT flags + helper delete + keep map on error | 1, 2 |
| §6 unsubscribe options; other PUTs clean | 3 |
| §6 leftover-job fallback | 4 |
| §7 errors / no rollback | 3, 4 |
| §8 tests | 1–4 |
| §9 i18n | 5 |
