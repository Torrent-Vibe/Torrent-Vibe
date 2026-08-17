# Generic Discover Shell — Design Spec

2026-08-17 · Status: draft (awaiting review)

Supersedes the implementation choice in
`2026-08-16-bangumi-discover-ui-design.md` that Discover is a modal whose
root special-cases Mikan vs M-Team. Mikan browse/stack chrome, M-Team
list + preview, helper pairing, and store/actions stay as they are
except where this spec names a shell or routing change.

## 1. What it is

Discover is a generic full-page shell: one header with slots, one
routed outlet for the active provider. Mikan and M-Team are workspaces
plugged into that shell. Adding a third provider does not edit the
shell.

It is not a new product surface. Provider-specific UX (Mikan season
wall, M-Team filters/preview) does not move into the shell.

## 2. Decisions

| Topic | Choice |
| --- | --- |
| Shell | Always `DiscoverModalHeader` + `<Outlet />`. No `activeProviderId === 'mikan'` in the shell. |
| Header | Slotted. `start` / `end` come from the active workspace. |
| Workspace lookup | Registry keyed by `DiscoverProviderId`. |
| Presentation | First-class route. Replaces `/`. Not a `Modal.present` overlay. |
| URL | `/discover/:type` (`mteam` \| `mikan`). Electron hash: `/#/discover/:type`. |
| Source of truth for workspace | URL `:type`. Store `activeProviderId` is synced from the param. |
| Provider switch | `navigate('/discover/${id}', { replace: true })`. |
| Open | `navigate('/discover/${lastOrFallback}')`. |
| Close | `navigate('/')`. Never `navigate(-1)`. |
| Mikan stack | Stays in the existing store. No `/discover/mikan/bangumi/:id` this round. |
| Module path | Keep `modules/modals/DiscoverModal`. Pages only compose it. |

## 3. Out of scope

- Nested Mikan routes (`bangumi`, `subscriptions`)
- Renaming the DiscoverModal package
- Changing search, preview, import, or subscription actions
- New store fields
- Left provider sidebar
- Redesigning M-Team or Mikan body UX
- iOS

## 4. Routes

File-based routes via `vite-plugin-route-builder`:

```
apps/main/pages/(main)/discover/layout.tsx
apps/main/pages/(main)/discover/index.tsx
apps/main/pages/(main)/discover/[type]/index.tsx
```

| Path | File | Role |
| --- | --- | --- |
| `/discover` | `discover/index.tsx` | Redirect to last provider, else `/discover/mteam`. |
| `/discover/:type` | `discover/[type]/index.tsx` | Render `registry[type].Body`. Invalid type redirects the same way as `/discover`. |
| layout | `discover/layout.tsx` | Connection loader + header + `<Outlet />`. |

`(main)` does not add a path segment.

Do not add `(main)/layout.tsx` this round. Electron and web `/` pages
already have different loaders (`checkHasPersistMultiServerConfig` vs
`checkHasPersistConnectionConfig`). Discover layout uses a shared
`requireConnection` helper extracted from those loaders, with the
existing `.electron` specific-import split if both platforms would
otherwise duplicate the check.

## 5. Shell

The layout is the only Discover chrome:

```tsx
<DiscoverModalHeader
  start={<ws.HeaderStart />}
  end={ws.HeaderEnd ? <ws.HeaderEnd /> : null}
  {...headerOptions}
  onClose={() => navigate('/')}
/>
<Outlet />
```

`ws` is `discoverWorkspaces[type]` after the param is validated.
`headerOptions` is `ws.useHeader?.() ?? ws.header ?? {}`.

Layout responsibilities:

1. Connection loader (same rule as `/`).
2. Read `:type`, reject unknown ids.
3. Sync `activeProviderId` and run the existing configure /
   `updateProviderMeta` effects.
4. Toast `searchError === 'requestFailed'`.
5. Render header slots + outlet.

Layout does not render FilterBar, results, Mikan wall, or empty states.

`DiscoverModal.tsx` becomes the shell component the route layout
renders (header slots + configure effects + toast). It is no longer a
`ModalComponent`: drop `contentClassName` / `showCloseButton` /
`disableDrag` and every `Modal.present(DiscoverModal)` call (desktop,
macOS, mobile headers). Those buttons call a shared
`openDiscover(lastOrFallback)` helper that `navigate`s to
`/discover/${id}`.

`ProviderSelect` must not call `setActiveProviderId`. It only
`navigate`s. The layout is the single writer from URL → store.

## 6. Workspace registry

```ts
type DiscoverWorkspaceHeaderOptions = {
  provider?: boolean
  providerCompact?: boolean
  settings?: boolean
}

type DiscoverWorkspace = {
  HeaderStart: ComponentType
  HeaderEnd?: ComponentType
  Body: ComponentType
  header?: DiscoverWorkspaceHeaderOptions
  useHeader?: () => DiscoverWorkspaceHeaderOptions
}

export const discoverWorkspaces: Record<DiscoverProviderId, DiscoverWorkspace>
```

Unknown ids never reach the registry; the route redirects first.

### mteam

| Slot | Content |
| --- | --- |
| `HeaderStart` | Current title + subtitle (`DiscoverMTeamHeaderStart`). |
| `HeaderEnd` | None. |
| `header` | `{ settings: true }` |
| `Body` | Current else-branch: `DiscoverFilterBar` + `ResizableLayout` (toolbar, empty/loading/list, pagination, preview). |

### mikan

`HeaderStart` / `HeaderEnd` / `useHeader` read `mikanStack`. The shell
does not branch on stack.

| Slot | Browse (`stack` empty) | Stack frame (bangumi / subscriptions) |
| --- | --- | --- |
| `HeaderStart` | `MikanSearchField` | Back + title |
| `HeaderEnd` | Season / subscriptions entry | Bangumi actions; subscriptions page none |
| `useHeader()` | `{ providerCompact: true }` | `{ provider: false }` |
| `Body` | Season wall / search results | `MikanBangumiPage` / `MikanSubscriptionsTab` |

Body keeps auto-search, scroll restore, and empty/error states. Close
is not passed into Body.

## 7. Files

```
DiscoverModal/
  DiscoverModal.tsx          // shell: configure, toast, Header + children/Outlet
  workspaces.ts              // registry
  open.ts                    // openDiscover(id) → navigate
  components/                // shared Header, EmptyState, SearchInput, …
  mikan/
    workspace.ts
    MikanHeaderStart.tsx
    MikanHeaderEnd.tsx
    MikanBody.tsx            // current MikanWorkspace minus Header
  mteam/
    workspace.ts
    MTeamHeaderStart.tsx
    MTeamBody.tsx            // current modal else-branch
```

`discover/layout.tsx` renders `DiscoverModal` (the shell) around
`<Outlet />`. `discover/[type]/index.tsx` only renders
`discoverWorkspaces[type].Body`. `/discover` and invalid `:type` share
one redirect helper with the header open button:
`resolveLastProvider(remembered, readyIds) ?? 'mteam'`.

## 8. Data flow

Open / provider list change (layout, same as today):

1. `useDiscoverProviders()` yields registered ids and `ready`.
2. `resolveLastProvider(remembered, readyIds)` is the only fallback
   used by `/discover`, invalid `:type`, and the header Discover
   button. The URL is written to that id; the store is not the
   navigation API. Unready last-provider is skipped when a ready id
   exists (same as today).
3. Configure effect: implementation + filter signature →
   `configureProvider` or `updateProviderMeta`.

Switch provider:

1. Header `ProviderSelect` validates via `selectDiscoverProvider`
   (unready → settings, unchanged).
2. Ready id → `navigate('/discover/${id}', { replace: true })`.
3. Layout sees the new param, syncs store, configure resets keyword /
   filters / items / preview / mikan stack (existing
   `configureProvider`).

Empty / unready provider:

- Layout still renders that workspace’s header + body.
- Body paints `DiscoverEmptyState` and the settings CTA.
- Layout does not add a third empty state.

Search failure: layout toasts `requestFailed`. Mikan body empty states
stay. They do not compete.

Dismiss: store is not `reset()`. Next open uses last provider, same as
today.

No new store fields. `useHeader()` only reads existing `mikanStack`.

## 9. Error handling

| Case | Behavior |
| --- | --- |
| `/discover` | Redirect last provider, else `mteam`. |
| Unknown `:type` | Same redirect. |
| No connection config | Loader → `/onboarding`. |
| Provider not ready | Body empty state, not a redirect. |
| Search request failed | Layout toast; Mikan also keeps its inline empty state. |

## 10. Testing

Required: lint / typecheck on touched files only.

Manual:

- Open Discover from desktop, macOS, and mobile headers → URL is
  `/discover/{last}`.
- Switch Mikan ↔ M-Team → URL replaces, header slots and body swap,
  configure resets provider state.
- Close → `/`. Deep link `/discover/mikan` then close still lands on
  `/`, not off-app.
- `/discover` and `/discover/nope` redirect.
- Unready provider empty state still opens Settings → Discover.
- Mikan: browse header (search + compact provider), push bangumi
  (back + title, no provider select), pop restores browse.
- M-Team: filters, list, pagination, preview unchanged.

## 11. Success

- `DiscoverModal.tsx` / discover layout contains no provider id
  ternary.
- A new provider is a registry entry + a folder. Layout and
  `[type]/index.tsx` do not change.
- Mikan and M-Team look and behave as they do now, except Discover is
  a page at `/discover/:type`.
