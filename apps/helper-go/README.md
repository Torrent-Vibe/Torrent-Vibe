# torrent-vibe-helper

Sidecar for a local qBittorrent. Pair from Torrent Vibe.

```bash
go run ./cmd/torrent-vibe-helper
```

Default port `17890`. Pairing code is printed at boot.

## Flags / env

| Flag | Env | Default |
| --- | --- | --- |
| `-port` | `PORT` | `17890` |
| `-data-dir` | `DATA_DIR` | `./data` |
| `-library-root` | `LIBRARY_ROOT` | empty |
| `-qbit-url` | `QBIT_URL` | `http://127.0.0.1:8080` |
| `-qbit-user` | `QBIT_USER` | `admin` |
| `-qbit-pass` | `QBIT_PASS` | empty |
| `-poll-interval` | `POLL_INTERVAL_MS` | `600000` |

`MIKAN_HELPER_DISABLE_MDNS=1` skips `_torrentvibe-helper._tcp`.

## Docker

Build from `apps/helper-go`:

```bash
docker build -t torrent-vibe-helper .
```
