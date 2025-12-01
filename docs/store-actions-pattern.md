# Store + Actions Pattern

Use this pattern for any complex UI module (modals, dashboards, wizards, etc.) that needs shared state, async side-effects, and reusable logic. The Discover modal is the reference implementation—see `docs/discover-modal-architecture.md` for a concrete example.

## Principles

1. **Single source of truth** — A Zustand store (`store.ts`) holds only serializable state. It defines the initial shape and exposes `getState`/`setState`. Do not put derived data, async calls, or business rules into the store definition.
2. **Global singleton actions** — A `*Actions` class (e.g. `DiscoverModalActions`) encapsulates every side-effect: service calls, optimistic updates, selection logic, and concurrency guards. Export a single instance (usually `shared`) so the same logic works from UI, background tasks, or agents.
3. **Selectors in UI** — Components subscribe with selectors (`useStore(state => state.slice)`) for fine-grained re-renders, then invoke actions directly on user events. Components never mutate the store themselves.
4. **Result-based feedback** — Actions return `{ ok, data?, error? }`. UI surfaces messages (toast, inline banner) based on the `error` code, keeping rendering concerns out of the actions.

## Implementation checklist

- `store.ts`
  - Export `useXStore` via `createWithEqualityFn + subscribeWithSelector + immer`.
  - Provide a helper (`xStore`) exposing `getState` / `setState` / `reset` for actions to use.
  - Store only raw values: inputs, fetched results, flags. Derive display values in selectors or components.

- `actions/`
  - `index.ts` stitches together feature-specific slices and exposes the singleton.
  - `slices/*` group related side-effects (provider, form, search, history, selection, preview, importing).
  - Shared helpers live in `actions/context.ts` (tokens, persistence) and `actions/utils.ts` (pure utilities).
  - Use request tokens when loading paginated or preview data to avoid stale updates.
  - Keep user-facing strings out of slices; return symbolic `error` keys instead.
  - Expose imperative helpers (`configure`, `search`, `goToPage`, `toggleSelection`, `importSelected`, etc.).

- UI components
  - Select minimal slices from the store.
  - Call actions inside handlers (`onClick={() => DiscoverModalActions.shared.search()}`).
  - Map returned `error` keys to localized messages.
  - Avoid prop drilling; each component subscribes to the pieces it needs.

## When to apply

Adopt this pattern whenever a feature needs:

- Shared state across multiple components.
- Async workflows (search, preview, import, etc.).
- Logic reuse outside React (automation, background tasks).
- Deterministic control over optimistic updates and race conditions.

For simple components, local `useState` is fine. Once the feature spans multiple files or requires cross-component coordination, migrate to this pattern.

## Further reading

- `docs/discover-modal-architecture.md` — Full reference implementation with search, pagination, preview, and import flows.
- `AGENTS.md` — High-level repo guidelines and expectations for agents contributing to complex modules.
