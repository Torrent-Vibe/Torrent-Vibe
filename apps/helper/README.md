# @torrent-vibe/helper

Sidecar daemon for a local qBittorrent.
Pair from Torrent Vibe, then push subscription replicas.

## Run

```bash
pnpm --filter @torrent-vibe/helper start
```

Default listen port: `17890`.
The 6-character pairing code is printed at boot.

## Environment

| Variable                    | Default                          | Description                                   |
| --------------------------- | -------------------------------- | --------------------------------------------- |
| `PORT`                      | `17890`                          | HTTP listen port                              |
| `DATA_DIR`                  | `./data`                         | Replica list and generated token              |
| `LIBRARY_ROOT`              | _(empty)_                        | Library root used by the download loop        |
| `QBIT_URL`                  | `http://127.0.0.1:8080`          | Advertised local qBittorrent WebUI            |
| `QBIT_USER`                 | `admin`                          | qBittorrent username                          |
| `QBIT_PASS`                 | _(empty)_                        | qBittorrent password                          |
| `TOKEN`                     | generated into `$DATA_DIR/token` | Bearer token returned by `POST /pair`         |
| `MIKAN_HELPER_DISABLE_MDNS` | unset                            | Set to `1` to skip `_torrentvibe-helper._tcp` |

Unauthenticated: `GET /discover`, `POST /pair`.
All other routes need `Authorization: Bearer <token>`.

## Docker

Build from the repository root:

```bash
docker build -f apps/helper/Dockerfile -t torrent-vibe-helper .
```

```bash
docker run --rm -p 17890:17890 \
  -e QBIT_URL=http://127.0.0.1:8080 \
  -e QBIT_USER=admin \
  -e QBIT_PASS=adminadmin \
  -e LIBRARY_ROOT=/library \
  -e DATA_DIR=/data \
  -v /path/to/data:/data \
  -v /path/to/library:/library \
  torrent-vibe-helper
```

Publish `17890` to the host, the same way the qBittorrent WebUI is published.
