# Helper Outbound Proxy

2026-08-16 · Status: approved

Give the helper an external HTTP or SOCKS5 proxy for internet fetches
only. Local qBittorrent stays direct.

## Decisions

| Topic | Choice |
| --- | --- |
| Traffic | Mikan RSS + Bangumi API only |
| qBittorrent | Never proxied |
| Protocols | `http`, `https`, `socks5`, `socks5h` via one URL |
| Empty value | Direct |
| Config | `-proxy` / `PROXY` / `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY` as first-boot defaults; `config.json` + `/config` win after that |
| UI | Helper settings field `proxyUrl` |
| Probe | No connectivity check on save |

## Contract

`GET/PUT /config` adds `proxyUrl` (string). Invalid scheme or unparsable
URL → `400`. Saving rebuilds the outbound client used by RSS fetch and
`api.bgm.tv`. `ApplyConfig` already restarts the poll loop.

`Public()` includes `proxyUrl` as stored. Auth in the URL is allowed.

`torrent-vibe-helper install` writes `PROXY=` into the unit when set.

## Out of scope

- Per-site proxies
- Proxying the helper listen port or qBittorrent
- PAC / `NO_PROXY` lists
