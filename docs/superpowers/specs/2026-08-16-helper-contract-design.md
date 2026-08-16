# Helper Contract Gaps — Design Spec

2026-08-16 · Status: drafted for review

Closes gaps in the shipped helper against
`2026-08-15-mikan-discover-design.md`, and replaces the TypeScript daemon
with a Go binary so a download host can install it without Node or a
repo checkout.

Torrent-Vibe stays the subscription source of truth. The helper stays a
per-host executor. Discover chrome, Mikan HTML (season wall / search /
detail), and single-episode import stay in TypeScript.

iOS remains out of scope. The HTTP contract must stay usable by a later
client that is not Electron.

## 1. What it is

1. **Go daemon** — replace `apps/helper` (TS) with a static Go binary.
   Contract gaps below are implemented once, in Go. Do not keep two
   daemons.
2. **Install** — GitHub Release assets + a one-line install command in
   the pairing panel. Optional scratch Docker image wraps the same
   binary; Docker is not the default path.
3. **Lifecycle** — persist bind state, add `/unpair`, make unbind actually
   stop the helper.
4. **Remote config** — after pairing, Electron can edit the helper’s
   library / category / local qBittorrent / poll interval.
5. **Discovery** — Electron browses `_torrentvibe-helper._tcp`. Web does
   not.
6. **Parse and retry** — Bangumi.tv fallback for season/episode, real
   `renaming` state, explicit retry for failed / needs-manual adds.

## 2. Decisions

| Topic | Choice |
| --- | --- |
| Helper language | Go. Electron, `helper-protocol`, and `@torrent-vibe/mikan` HTML stay TS |
| Dual daemon | No. Delete the TS helper after the Go binary matches the contract |
| Approach | Expand the helper HTTP contract; Electron is only a client |
| Install default | Download a release binary onto the qBittorrent host |
| Docker | Optional `FROM scratch` image of that binary, not the install default |
| Ported Mikan surface | RSS + title parse only. Wall / search / detail stay in TS |
| Cardinality | One Torrent-Vibe ↔ N qBittorrent servers; one server profile ↔ 0 or 1 helper; one helper ↔ one local qBittorrent |
| Helper uniqueness | One helper URL may be bound to at most one server profile in this Torrent-Vibe |
| Token sharing | Not a product. Rebind of the *same* profile keeps the token. Unpair rotates it |
| Unbind vs delete server | Unbind keeps subscription `targetServerIds`. Delete server (`forgetServer`) unpairs then strips that target |
| Config persistence | `$DATA_DIR/config.json` overlays flags/env. Flags/env are first-boot defaults only |
| mDNS browse | Electron main-process IPC only. Web stays same-host probe + manual URL |
| Auto-bind | Never |
| Bangumi fallback | Only when Mikan parse lacks season/episode *and* a unique Bangumi match exists |
| Failed add | Still skipped by RSS. Cleared only via `POST /retry` |

## 3. Out of scope

- Helper-to-helper sync
- Multiple helpers on one server profile
- Multiple Torrent-Vibe installs coordinating one helper (no per-client tokens)
- Moving files when `libraryRoot` changes
- Changing listen `PORT` or `DATA_DIR` over HTTP
- Helper HTML admin UI
- Web mDNS
- Retrying `done` episodes or bulk backfill through `/retry`
- NFO / posters / media library
- SSH/remote install from Electron
- Compiling the existing TS helper (`bun compile`, Node SEA)
- Porting `@torrent-vibe/mikan` HTML parsers to Go
- Implementing the new routes on the TS helper and then rewriting them

## 4. Go daemon and install

### 4.1 Layout

New module `apps/helper-go`. Packages stay small: `http`, `loop`, `qb`,
`rename`, `store`, `mdns`, `mikan` (RSS + title only), `bangumi`. Do not
put a `go.mod` inside the existing TS `apps/helper`.

Wire types are a Go copy of `packages/helper-protocol`. The source of
truth for the renderer remains the TS package. Compatibility is the JSON
HTTP contract, locked by tests — not a shared codegen step in v1.

Title and RSS parsers are ported from `packages/mikan` and must pass the
same fixtures (`packages/mikan/fixtures` and the existing title/RSS
cases). A fixture mismatch is a bug, not a dialect.

### 4.2 Runtime

Same listen port (`17890`), same mDNS type (`_torrentvibe-helper._tcp`),
same routes as today plus `/unpair`, `/config`, `/retry`.

Flags and env (env wins over default, overlay file wins over both):

| Flag / env | Default |
| --- | --- |
| `-port` / `PORT` | `17890` |
| `-data-dir` / `DATA_DIR` | `./data` |
| `-library-root` / `LIBRARY_ROOT` | empty |
| `-qbit-url` / `QBIT_URL` | `http://127.0.0.1:8080` |
| `-qbit-user` / `QBIT_USER` | `admin` |
| `-qbit-pass` / `QBIT_PASS` | empty |
| `-poll-interval` / `POLL_INTERVAL_MS` | `600000` |

Pairing code is printed to stdout at boot. `GET /discover` still returns
it; the pairing panel still requires the user to type it (proof they can
reach the machine). The UI does not auto-fill the code from `/discover`.

### 4.3 Release assets

CI publishes helper binaries as extra assets on the existing desktop
GitHub Release (same app version). The install command pins
`releases/latest` for that repo:

- `torrent-vibe-helper_<ver>_linux_amd64`
- `torrent-vibe-helper_<ver>_linux_arm64`
- optional darwin-arm64 / windows-amd64

Checksums file next to the binaries.

### 4.4 Fast install

Pairing panel (unbound) shows a copyable command. Default is Linux
amd64; a small arch switch covers arm64.

The command:

1. Downloads the matching release binary.
2. Installs to `/usr/local/bin/torrent-vibe-helper` (or `~/.local/bin` if
   not root).
3. Prints how to run it and where the pairing code appears
   (`torrent-vibe-helper` in the foreground, or a one-shot systemd user
   unit snippet).

No `curl | sudo bash` that configures systemd unattended. The user runs
the binary (or pastes the unit) so they see the pairing code.

Optional compose / `docker run` block uses the scratch image of the same
binary. `QBIT_URL` is the compose service name when qBittorrent is on
the same network; `libraryRoot` inside the container is a container
path.

### 4.5 Cutover

TS `apps/helper` stays in tree only until the Go binary covers today’s
routes **and** the new ones, with the tests in §11 green. Then delete
the TS daemon, its Dockerfile, and `pnpm --filter @torrent-vibe/helper`
scripts. `@torrent-vibe/mikan` and `helper-protocol` remain.

`$DATA_DIR` JSON shape is unchanged so a host that ran the TS helper can
point the Go binary at the same directory. Token-file migration is §5.1.

## 5. Cardinality

```
Torrent-Vibe (one app)
  server profile A  ──binding──  helper A  ──QBIT_URL──  qBittorrent A
  server profile B  ──binding──  helper B  ──QBIT_URL──  qBittorrent B
```

- `bindings[serverId] = { url, token }` stays a single object, not an array.
- The helper’s `QBIT_URL` is its own local WebUI (often `http://127.0.0.1:8080`
  or a compose service name). It is not copied from the Electron server URL.
- `GET /discover.advertisedQbitUrl` is a human check at pair time. The UI
  does not auto-match a helper to a server.
- Pairing a helper URL that is already stored on another `serverId` is
  rejected in Electron, with a message that names the other server. The
  helper does not know `serverId`; uniqueness is client-side only.

## 6. Lifecycle

### 6.1 Persistence

`$DATA_DIR/pairing.json`:

```
{ "bound": boolean, "token": string }
```

Boot loads this file (generate a token if missing, `bound` defaults false).
`GET /discover.bindState` is this disk value, not an in-memory flag.

If `pairing.json` is missing but the old `$DATA_DIR/token` file exists,
import that token and set `bound=false`, then write `pairing.json`. A
pre-upgrade helper that was already paired will show `unbound` until the
next successful `/pair` (the stored Electron token still works). Do not
infer `bound=true` from token existence — first boot also generates a
token.

### 6.2 `POST /pair`

Unauthenticated. Body `{ code }`.

- Wrong code: `403`, no state change.
- Right code: persist `bound=true`, return the **current** token.
- Already bound: same token (rebind of the same profile does not kick it).
- Pair never rotates the token.

### 6.3 `POST /unpair`

Bearer required.

- Persist `bound=false`.
- Rotate the token and write it to disk. The previous token gets `401`
  immediately. In-memory auth must see the new token.
- Clear all replicas **and** episode maps. The loop stops following.
- Clients do not need to `PUT []` first.
- Response `200 { ok: true }`.

### 6.4 Electron unbind (pairing panel)

1. If a binding exists, `POST /unpair` (best effort).
2. Always `clearHelperBinding(serverId)`.
3. Do **not** remove that id from subscription `targetServerIds`. The row
   stays and offers “绑定 Helper”.
4. Drop `statusByServer[serverId]`.
5. If `/unpair` failed because the helper was unreachable, toast that the
   local bind is gone but the helper may still be running. Rebind later
   replays the desired set.

### 6.5 Delete server

`forgetServer` first best-effort `/unpair` for that binding, then strips
the target from subscriptions (existing behavior). Other servers’ helpers
are untouched.

### 6.6 Auth errors

`401` / `403` on any authenticated helper call still only clear the local
binding. The client cannot `/unpair` without a valid token.

## 7. Remote config

### 7.1 Overlay

Boot: flags/env defaults, then `$DATA_DIR/config.json` overlay. Electron
writes only the overlay. Install flags and Docker env are not rewritten.

`pairing.json` stays separate from `config.json`.

### 7.2 Fields

| Field | GET | PUT | Notes |
| --- | --- | --- | --- |
| `libraryRoot` | yes | yes | New adds only. Do not move existing files |
| `category` | yes | yes | Default `Bangumi`. New adds only. Empty string is `400` |
| `qbitUrl` | yes | yes | Helper-local qBittorrent |
| `qbitUser` | yes | yes | |
| `qbitPass` | no; `hasQbitPass` instead | omit or empty = keep | |
| `pollIntervalMs` | yes | yes | Restart the loop timer |

Not writable over HTTP: `PORT`, `DATA_DIR`, token, pairing code.

### 7.3 Routes

- `GET /config` — Bearer. Never returns the password.
- `PUT /config` — Bearer, partial update.

If `qbitUrl` / `qbitUser` / `qbitPass` change, probe login first. Failure
is `400` and the overlay is not written. `libraryRoot` is not validated
against the host filesystem (container paths differ from host paths).

On success, write the overlay and apply live: update loop deps, recreate
the qBittorrent client when credentials/URL change, restart the poll
timer when `pollIntervalMs` changes.

### 7.4 Electron UI

After a successful pair, the same server’s helper panel shows these
fields. Each helper has its own config. Fetch failure shows an error; it
does not submit an empty form. Hint: `libraryRoot` is the path **the
helper process** sees (host path for a binary, container path for
Docker).

Unreachable helper: leave disk config as-is. Unpair does not reset
config.

## 8. Discovery

The Go helper advertises `_torrentvibe-helper._tcp`.

Electron main adds an IPC service (same `electron-ipc-decorator` pattern
as other services). The pairing panel `start()`s browse when shown and
`stop()`s when hidden. Each result: `name`, `host`, `port`, `txt.version`.

Pairing panel order:

1. Install command (unbound only)
2. Same-host probe (`{qbitHost}:17890`)
3. LAN helper list from mDNS
4. Manual URL

Selecting a list row fills the URL. Pairing still requires the code.
Never auto-bind.

A URL already bound to another profile is disabled in the list and names
that server. A URL bound to the *current* profile may rebind (same token).

Browse failure (permissions, firewall, timeout) is a quiet empty list.
Probe and manual URL stay available.

Web: no mDNS and no install command. Probe + manual URL only. Tailscale /
other L3: manual URL.

## 9. Parse fallback and retry

### 9.1 Season / episode

1. Parse the Mikan title (Go port of `parseMikanTitle`).
2. If season or episode is still missing **and** the replica has
   `bangumiSubjectId`, fetch Bangumi.tv episodes for that subject.
3. Accept the result only when **exactly one** episode matches:
   RSS `publishedAt` within one day of the Bangumi air date, or the title
   contains that Bangumi episode number.
4. Otherwise `needs-manual`. Never write `S00E00`.

Collections / multi-episode packs do not unique-match and stay
`needs-manual`. A Bangumi HTTP error is a parse miss, not a subscription
failure. Cache episode lists by `subjectId` for 1 hour in process.
Bangumi is not a subscription source.

### 9.2 `renaming`

Set `renaming` before calling the qBittorrent rename API. Success →
`done`. Failure → `failed`, keep the torrent, retry rename on the next
tick.

### 9.3 `POST /retry`

Bearer. Body `{ bangumiId, subgroupId, episodeId }`.

- Allowed current states: `failed`, `needs-manual`.
- Reset that episode to `pending` (drop `infohash` and `lastError`), then
  run ingest immediately (title parse + Bangumi fallback + add).
- Still unparseable or add-fail → `needs-manual` / `failed` with a new
  `lastError`.

Electron: a Retry control on failed rows in 我的订阅 and on the bangumi
page. Unreachable helper → toast only. `/backfill` is unchanged and does
not go through `/retry`.

RSS continues to skip episode ids already recorded as `failed`.

## 10. Error handling

| Failure | Behavior |
| --- | --- |
| Wrong pairing code | `403`, binding unchanged |
| `/unpair` while helper down | Local bind cleared; helper may still run; toast |
| Pair URL already used by another server | Electron rejects; helper untouched |
| `PUT /config` bad qBit login | `400`, overlay unchanged |
| `PUT /config` helper down | Electron error; disk config unchanged |
| mDNS empty or blocked | Empty list; probe / manual still work |
| Bangumi fetch fails | That item `needs-manual`; subscription stays |
| `/retry` on `done` / `added` / `downloading` | `400` |
| Authenticated call `401` / `403` | Clear local binding only |
| Unknown GOARCH in install snippet | User picks amd64/arm64; no auto-detect on the NAS |

## 11. Testing

Pure logic, no live Mikan, Bangumi, or qBittorrent in CI.

- **Fixture parity**: Go title + RSS parsers accept every
  `packages/mikan` fixture the TS parsers accept; outputs match.
- **Existing loop/http cases**: port the TS helper tests (dedupe, skip
  present hashes, rename video+subs, skip Sample/NCOP/NCED, backfill).
- **Pairing persist**: pair → restart discover reports `bound`; token still
  works.
- **Unpair**: replicas and episode maps empty; old token `401`; new pair
  returns the rotated token.
- **Electron unbind**: subscription targets kept; delete server strips them.
- **URL uniqueness**: second profile cannot store the same helper URL.
- **Config overlay**: file wins over flags/env; GET omits password;
  partial PUT; failed qBit probe does not write.
- **Loop apply**: next add uses new `libraryRoot` / `category`.
- **Bangumi fallback**: unique airdate match fills episode; pack title
  stays `needs-manual`; missing subject id skips the fetch.
- **Retry**: `failed` add is re-attempted; `done` is rejected.
- **Rename state**: in-flight rename is `renaming`.

mDNS browse, install-command copy, and pairing-panel layout are a manual
Electron pass. No CI that needs a LAN.

## 12. Implementation order

1. Go module: HTTP skeleton (today’s `/discover` `/pair` `/subscriptions`
   `/status` `/backfill`) + store + qBit client + RSS/title port with
   fixture tests.
2. Loop: add, completion, rename (`renaming` state).
3. `pairing.json` + `/unpair` + bindState on disk.
4. `config.json` overlay + `GET/PUT /config` + live apply.
5. Bangumi fallback + `POST /retry`.
6. Release binaries (linux amd64/arm64) + pairing-panel install command.
7. Electron: unbind / forgetServer / URL uniqueness / config fields /
   mDNS list / retry controls.
8. Delete TS `apps/helper`.

## 13. Success

- A download host gets a helper by downloading one binary and running it;
  pairing code is on stdout.
- Unbind on a reachable helper stops that host from adding or renaming.
- Helper restart still reports `bound` until `/unpair`.
- Two qBittorrent profiles in one Torrent-Vibe can each have their own
  helper; the same helper URL cannot be attached twice.
- After pair, library root / category / helper qBit URL can be changed
  without editing flags.
- Electron pairing panel lists LAN helpers; pairing still needs the code.
- Unparseable titles that uniquely match Bangumi get a season/episode;
  packs stay `needs-manual`.
- A failed add can be retried without deleting the subscription.
- No TypeScript helper process remains in the repo.
