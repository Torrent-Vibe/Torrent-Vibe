# torrent-vibe-helper

Sidecar for a local qBittorrent. Pair from Torrent Vibe.

```bash
go run ./cmd/torrent-vibe-helper
```

Default port `17890`.

## Pairing code

The six-character code lives in `<data-dir>/pairing-code` (`0600`) and survives
restarts. It is printed at boot, printed once more when `install` finishes, and
can be read back at any time on the host:

```bash
~/.local/bin/torrent-vibe-helper code            # print the current code
~/.local/bin/torrent-vibe-helper code --rotate   # replace it, no restart needed
```

Without `-data-dir`/`DATA_DIR`, `code` resolves the data dir from the installed
systemd unit, so it matches the running daemon.

`/pair` reads the file on every request, so a rotation takes effect immediately.

## Client pairing

- `GET /discover` reports reachability and client count, but never returns the pairing code.
- `POST /pair` accepts the host-displayed code plus `clientId` and `clientName`, and returns an independent Bearer token for that client.
- Wrong codes are throttled: 5 failures per source address per minute, plus a 50-per-minute cap across all addresses. Blocked requests receive `429` with `Retry-After`. A successful pair clears the source address.
- `POST /unpair` revokes only the authenticated client. Other clients and subscription data remain active.
- Existing bound `pairing.json` files migrate to schema v2 on boot; the previous token remains valid, while only its SHA-256 hash is retained on disk.

Subscription reads return `{ revision, replicas }`. A full-set `PUT /subscriptions` must include the revision it read; stale writes receive `409` with the current snapshot.

## Credential profile sync

Paired clients may use `GET /profile` and revision-checked `PATCH /profile` to
store selected application configuration on the Helper. Records use stable
namespaced keys such as `discover.mteam.apiKey` and `ai.openai.apiKey`.

- Synchronization is always initiated by the user; pairing does not upload or pull data.
- A patch changes only its explicit `set` or `delete` mutations. Omitted records remain unchanged.
- Stale revisions receive `409` with the latest profile snapshot.
- `profile.json` is written atomically with owner-only (`0600`) permissions. Every paired client can read the profile, including records marked `secret`.

## Flags / env

| Flag             | Env                | Default                 |
| ---------------- | ------------------ | ----------------------- |
| `-port`          | `PORT`             | `17890`                 |
| `-data-dir`      | `DATA_DIR`         | `./data`                |
| `-library-root`  | `LIBRARY_ROOT`     | empty                   |
| `-qbit-url`      | `QBIT_URL`         | `http://127.0.0.1:8080` |
| `-qbit-user`     | `QBIT_USER`        | `admin`                 |
| `-qbit-pass`     | `QBIT_PASS`        | empty                   |
| `-poll-interval` | `POLL_INTERVAL_MS` | `600000`                |

Subcommands: `install` (user systemd unit), `code` (print the pairing code, `--rotate` to replace it).

`MIKAN_HELPER_DISABLE_MDNS=1` skips `_torrentvibe-helper._tcp`.

## Docker

Build from `apps/helper-go`:

```bash
docker build -t torrent-vibe-helper .
```

## Dev sync (local Linux amd64 → download host)

From the repo root, with Docker running:

```bash
HELPER_SSH=user@nas pnpm helper:sync
```

This builds `linux/amd64` in `golang:1.25-bookworm`, copies it to
`$HOME/.local/bin/torrent-vibe-helper` over SSH, restarts the user systemd
unit, and checks `GET :17890/discover`. Data dir and pairing stay on the host.
