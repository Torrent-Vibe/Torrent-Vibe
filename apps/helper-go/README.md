# torrent-vibe-helper

Sidecar for a local qBittorrent. Pair from Torrent Vibe.

```bash
go run ./cmd/torrent-vibe-helper
```

Default port `17890`. Pairing code is printed at boot.

## Client pairing

- `GET /discover` reports reachability and client count, but never returns the pairing code.
- `POST /pair` accepts the host-displayed code plus `clientId` and `clientName`, and returns an independent Bearer token for that client.
- `POST /unpair` revokes only the authenticated client. Other clients and subscription data remain active.
- Existing bound `pairing.json` files migrate to schema v2 on boot; the previous token remains valid, while only its SHA-256 hash is retained on disk.

Subscription reads return `{ revision, replicas }`. A full-set `PUT /subscriptions` must include the revision it read; stale writes receive `409` with the current snapshot.

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
