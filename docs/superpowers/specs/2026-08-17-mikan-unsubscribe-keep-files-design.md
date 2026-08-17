# Mikan Unsubscribe File Retention — Design Spec

2026-08-17 · Status: approved

Extends `2026-08-15-mikan-discover-design.md` and
`2026-08-16-helper-contract-design.md`. Subscriptions stay the source of
truth. Helpers stay per-host executors. This spec only changes what
happens when the user explicitly unsubscribes.

## 1. What it is

Unsubscribing a Mikan bangumi+subgroup stops following **and** removes
the torrents that subscription added to each target qBittorrent. The
user chooses whether those torrents’ local files stay on disk.

Today unsubscribe only drops the Torrent-Vibe row and PUTs the remaining
replica set. Helpers delete the replica. Torrents and files are
untouched.

## 2. Decisions

| Topic | Choice |
| --- | --- |
| Torrents | Always remove the subscription’s torrents from every target qBittorrent |
| Files | Optional. Checkbox “同时删除本地文件”, default unchecked (keep files) |
| Protocol | Extend `PUT /subscriptions` with `removeTorrents` + `deleteFiles` |
| Who deletes | Helper, using its episode infohashes and local qBittorrent |
| Old helper | Extra fields ignored. Electron falls back via leftover `/status` jobs |
| Partial retarget | Dropping some (not all) targets only stops following on those helpers. Torrents stay |
| Empty retarget | Same as unsubscribe: same confirm, then `unsubscribe` |
| Sync / unpair / delete server | Do **not** send `removeTorrents`. No torrent delete |
| Empty library folders | Not cleaned. qBittorrent deletes files by hash only |
| Rollback | Never re-add a dropped subscription because delete failed |

## 3. Out of scope

- Deleting torrents the user added manually (no helper infohash)
- Cleaning `{libraryRoot}/{title}/` after the last file is gone
- A new HTTP route (`POST /unsubscribe`)
- Changing subscribe, backfill, retry, or rename
- iOS
- Unpair / `forgetServer` deleting torrents

## 4. UI

One confirm, reused everywhere. Same shape as `DeleteTorrentPrompt`:
title, description, checkbox, danger confirm.

- Title: 取消订阅
- Description: 将停止追更「{{title}}」，并从所有目标 qBittorrent 移除已添加的种子。
- Checkbox: 同时删除本地文件. Default off.
- Confirm: 取消订阅

Entry points:

| Entry | Behavior |
| --- | --- |
| 我的订阅 → 取消订阅 | Open this confirm |
| Bangumi page → 取消订阅 | Same confirm |
| Edit targets → select none → confirm | Allow an empty selection. Button label becomes 取消订阅. Confirm opens the same dialog. Cancel leaves targets and the subscription unchanged |

`presentBangumiUnsubscribe` is the only prompt. The subscriptions tab
inline `Prompt.prompt` goes away.

`MikanSubscribeTargetsModal` currently disables confirm when
`selected.length === 0`. Enable it. Callers that receive `[]` must open
the unsubscribe confirm and call `unsubscribe`, not `retarget([])`.

## 5. Protocol

`PUT /subscriptions` body:

```json
{
  "replicas": [],
  "removeTorrents": true,
  "deleteFiles": false
}
```

`replicas` is still the full desired set (last-write-wins). The two new
fields are optional. Absent or `false` `removeTorrents` is today’s
behavior.

When `removeTorrents` is true, for each `OpRemove` in
`desiredStateDiff(desired, current)`:

1. Load that replica’s episode list (`bangumiId:subgroupId`).
2. Collect non-empty infohashes.
3. Call qBittorrent `POST /api/v2/torrents/delete` with those hashes and
   `deleteFiles` as given. Skip the call when the hash list is empty.
4. If the delete succeeds (or there was nothing to delete), drop that
   episode map key.
5. If the delete fails, keep the episode map so Electron can fall back.
6. Then save the remaining replica list as today.

Helper-go needs `qb.DeleteTorrents(hashes []string, deleteFiles bool)`.
There is no delete method today.

`packages/helper-protocol` does not need a new type if Electron sends the
flags only on the HTTP body. The helper JSON struct must accept them.

## 6. Electron data flow

`unsubscribe(id, { deleteFiles?: boolean })`:

1. Remove the row from the subscription store and persist (same as now).
2. `PUT /subscriptions` to each former target with the remaining desired
   set, `removeTorrents: true`, and the user’s `deleteFiles`.
3. `GET /status` per target. If leftover jobs for that
   `bangumiId`+`subgroupId` still have hashes, delete those hashes
   through that server’s qBittorrent client with the same `deleteFiles`.
   A new helper that already deleted has no leftover jobs; this is a
   no-op.
4. Record `syncByServer` as today. Return `{ ok: true }` or
   `{ ok: false, error: 'partialSync' }`.

`subscribe`, `retarget` (non-empty), `syncServers`, and `syncAll` must
not send `removeTorrents` or `deleteFiles`.

`retarget(id, [])` stays as a programmatic alias for `unsubscribe(id)`
with `deleteFiles: false`. The UI never calls it: empty target confirm
goes through the prompt so the user can choose files.

`HelperSyncClient.putSubscriptions` gains an optional third argument
for the two flags so tests can assert they are only set on unsubscribe.

## 7. Errors

Unsubscribe commits locally first. A later helper or qBittorrent failure
does not restore the row.

| Case | Result |
| --- | --- |
| Helper unreachable | Local row gone. That server `partialSync`. Torrents may remain. Toast. |
| New helper, qBittorrent delete fails | Replica removed (follow stops). Episode map kept. Electron fallback tries. If that fails too, toast; torrents stay. |
| Old helper | PUT only drops the replica. Leftover jobs carry hashes. Electron fallback deletes. If qBittorrent is also unreachable, toast and suggest updating the helper. |
| No infohashes (pending / failed / never added) | Follow stops. Nothing to delete. |
| Some of N targets fail | Successful helpers/qBits delete; failures stay listed as errors. No rollback. |
| Unpair, delete server, launch sync | No `removeTorrents`. Torrents untouched. |

UI toasts only on `partialSync`. Success is silent.

## 8. Tests

Helper:

- PUT with `removeTorrents` deletes hashes for removed replicas and
  forwards `deleteFiles`.
- PUT without the flag does not delete torrents or episode maps.
- qBittorrent delete failure still drops the replica and keeps the
  episode map.

Electron:

- `unsubscribe(id, { deleteFiles })` PUTs the remaining set with
  `removeTorrents` and `deleteFiles`.
- subscribe / retarget / `syncAll` PUTs omit both flags.
- Empty-target UI path calls `unsubscribe` after the shared prompt.

No change to `desiredStateDiff` fixtures, hydrate, or pairing tests
beyond the new PUT body field.

## 9. i18n

Update `discover.modal.mikan.unsubscribeConfirm`. Add
`discover.modal.mikan.unsubscribeDeleteFiles`. Reuse
`discover.modal.mikan.unsubscribe` / `unsubscribeTitle`. Both `en` and
`zh-CN`.
