# qBittorrent per-connection session pool

Date: 2026-08-15

## Goal

Stop a successful login from being wiped by a later `configure` /
`callWithConfig`. Keep the renderer on `QBittorrentClient.shared` as
"the active server". Hold one SID per connection in the main process.

Simultaneous multi-server UI (approach C) is out of this change. The
session pool is the seam C will sit on later.

## Decisions

1. Implement approach B now. Do not rewrite query keys, torrent store,
   or `QBittorrentClient.shared` call sites.
2. Main process owns a `Map<connectionKey, Session>`. Active key is
   whoever last called `setSharedConfig`.
3. `callWithConfig` uses the session for that config and never writes
   the active SID.
4. `setSharedConfig` keeps an existing SID when the connection key and
   credentials are unchanged.
5. `MultiServerInitializer` never calls `QBittorrentClient.configure`.
   Health monitor starts only when `servers.length > 1`.
6. Boot login belongs to `AuthManager` only: `configure` then `login`.
7. Onboarding / settings save must `login()` after `configure` before
   marking authenticated.
8. A 403 on a non-login call retries once: `login` on that session,
   then replay the original method.

## Out of scope

- Simultaneous view of two servers (C)
- Per-server query caches, torrent stores, or selection state
- Changing health-check product behavior beyond session isolation
- Patching `@innei/qbittorrent-browser` upstream

## Connection key

```
`${useHttps ? 'https' : 'http'}://${host}:${port}${normalizeBaseUrl(baseUrl)}|${username}`
```

- Password is not part of the key.
- Same host/port/user with a new password updates that session and
  clears its SID.
- Different username on the same host is a different session.

## Session shape

```ts
type QbSession = {
  key: string
  config: QBittorrentConfig
  client: QBittorrentClient
  sid: string | null
}
```

The fetch wrapper closes over the session object. Cookie inject and
`Set-Cookie` extract must not touch another session.

Extract the pool into `layer/main/src/ipc/qb-session-pool.ts` so
`qbittorrent.service.ts` stays an IPC facade.

## IPC

| Method | Behavior |
| --- | --- |
| `setSharedConfig(config)` | Upsert session for key. Preserve SID if key + username + password match. Set `activeKey`. Recreate the client so the new password is used. |
| `call(method, args)` | Run on the active session. Missing active session throws `QB client not configured`. |
| `callWithConfig(config, method, args)` | Upsert/use that key's session. Do not change `activeKey`. |

403 retry lives in the invoke helper, not in the fetch wrapper, so
`login` cannot recurse:

1. Invoke method.
2. If error is HTTP 403 and method is not `login`, call `login` on
   that session once, invoke again.
3. If the retry 403s, throw.

`login` returning HTTP 200 + body `Fails.` is still treated as success
by `@innei/qbittorrent-browser`. Wrap `login` in
`packages/qb-client` so a non-`Ok.` body is a failed login. The
session pool then does not keep a SID from a failed attempt.

## Renderer boot

```
RootProviders
  MultiServerInitializer   // hydrate store; health only if servers > 1
  AuthInitializer          // sole configure + login
```

`MultiServerInitializer` must not call `QBittorrentClient.configure`.
With one saved server the header `ServerSwitcher` already hydrates
the store and then returns `null`, so skipping health is enough.

Onboarding (web + electron) and `WebConnectionSection`:

```
validateConnection / login via create()
configure(config)          // set active session
await shared.login()       // SID on the active session
mark authenticated
```

Query retry treats 403 like 401 and asks `authManager` to refresh.

## Error mapping

Do not map every 403 to "invalid username or password".

- Login 403 or body `Fails.` → invalid credentials or IP banned.
- Later API 403 that recovers after re-login → session expired,
  stay quiet.
- Later API 403 after a failed re-login → surface the login error.

## Future: C

C is a product plan, not this PR: two servers visible at once.

This pool should stay usable for C:

- Sessions already keyed by connection, not by "the" client.
- Renderer will later need `getClient(serverId)` plus query / store
  keys that include `serverId`.
- Active-server singleton stays until that plan exists.

Do not add `getClient(serverId)` now.

## Verification

- `pnpm` lint/typecheck on touched files only.
- Manual: cold start with one server, `sync/maindata` is 200, no
  `setSharedConfig` after login that clears SID.
- Manual: onboarding save still lands authenticated without a
  second restart.
- If two servers exist, switching still logs into the target and
  health checks do not overwrite the active SID.
