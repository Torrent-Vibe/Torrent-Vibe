# Discover Modal Architecture

This module follows the shared [Store + Actions pattern](./store-actions-pattern.md) so the data flow stays predictable and easy to reason about. The notes below capture Discover-specific nuances; refer to the general guide for broader expectations.

## High-level flow

```
UI component -> DiscoverModalActions.<action>() -> DiscoverService/API -> store.ts state update -> UI selector re-render
```

- `store.ts` exposes a Zustand store that only holds raw state (provider metadata, form inputs, query results, selection, preview, importing flags). It **must not** contain business logic, async calls, or toast usage.
- `actions/index.ts` exports the `DiscoverModalActions` singleton. Feature-specific logic lives in `actions/slices/*`, while `actions/context.ts` manages shared helpers (tokens, persistence, helpers for history). Slices pull snapshots via `discoverModalStore.getState()`, call `DiscoverService` (or other modules like `TorrentActions`), then push state updates with `discoverModalStore.setState()`. Every async action should safeguard against race conditions with request tokens when applicable.
- UI components subscribe with selectors (`useDiscoverModalStore(state => state.xxx)`) for fine-grained updates and call `DiscoverModalActions.shared.<method>()` on user events.

## Store responsibilities

`DiscoverModalState` should include only primitive state values:

- Provider context: `activeProviderId`, `providerReady`, `pageSize`, filter definitions, default filters.
- Form + search state: `keyword`, `filters`, `committedSearch`, `items`, `total`, `hasMore`, `isSearching`, `searchError`.
- Selection & preview: `selectedIds`, `previewId`, `previewDetail`, `isPreviewLoading`, `previewError`.
- Import flag: `importing`.

Setter helper methods (e.g. `setKeyword`) live outside the store, inside actions. The store should only expose `getState()`/`setState()` via the `discoverModalStore` helper.

## Actions responsibilities

Each action method should:

1. Grab a snapshot (`discoverModalStore.getState()`).
2. Early-return with a typed `ActionResult` when a precondition fails (e.g. provider not ready).
3. Use `discoverModalStore.setState()` to apply optimistic updates before a request.
4. Call `DiscoverService`/`TorrentActions` and handle the response.
5. Guard against outdated promises with `this.searchToken`/`this.previewToken` style counters when fetching search or preview data.
6. Return `{ ok: boolean, error?: string }` so the caller decides how to render feedback (toast, UI message, etc.).

Do **not** emit toast notifications inside actions; keep user-facing feedback in the UI layer.

### Common actions

- `configureProvider` resets the store when the provider changes and drops in default filters.
- `performSearch` and `goToPage` share the `fetchPage` helper and manage search concurrency tokens.
- `toggleSelection` and `selectAll` adjust the selection set and delegate preview management to `setPreview`.
- `setPreview` triggers preview fetching and handles stale responses with `previewToken`.
- `importSelected`/`importPreview` wrap download URL resolution and torrent submission.

## UI guidelines

- Always subscribe with selectors to avoid unnecessary re-renders (`useDiscoverModalStore(state => state.items)` instead of destructuring the full store).
- All user interactions should call an action; never mutate store state directly from a component.
- When actions return `error` codes, map them to localized messages in the component (e.g. `providerNotReady`, `requestFailed`, `selectionEmpty`).
- Use the existing i18n keys: `discover.messages.searchFailed`, `discover.messages.previewFailed`, `discover.messages.importFailed`, `discover.messages.importSuccess`, `discover.messages.providerNotReady`.

## Extending the modal

When adding new provider-specific filters or data fields:

1. Update the provider implementation and its `getFilterDefinitions` method.
2. Ensure `configureProvider` receives the new defaults.
3. Extend the store state/interface if you need additional persisted values.
4. Add actions or extend existing ones for the new behavior.
5. Update UI components to read from selectors and surface the new data.

## Testing checklist

- Run `pnpm typecheck:turbo` after any change.
- Manually verify: provider switching, initial filter defaults, searching, pagination, selection, preview loading, single/bulk import.
- Confirm optimistic state transitions (e.g. clearing selection after import) behave as expected without relying on a toast to hide issues.

Following this pattern keeps the Discover modal consistent with the rest of the app and makes it easier to share logic with automation agents.
