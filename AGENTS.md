# Repository Guidelines

## Project Structure & Module Organization
- `layer/main`: Electron main process (app lifecycle, IPC, packaging helpers).
- `layer/renderer`: React + Vite + Tailwind UI (entry: `src/main.tsx`).
- `scripts`: Build, signing, integrity, native prep scripts.
- `public`, `resources`, `assets`: Static files and icons bundled in builds.
- `locales`: i18n JSON validated by custom ESLint rules.
- `docs`, `plugins`: Documentation and build-time plugins.

## Build, Test, and Development Commands
- `pnpm dev:electron`: Start Electron with live reload for main/renderer.
- `pnpm dev`: Vite dev server for renderer only (browser preview).
- `pnpm build:electron`: Build app (electron-vite) and create installers (forge).
- `pnpm build`: Build renderer via Vite.
- `pnpm serve` / `pnpm start:electron`: Preview build in browser / Electron.
- `pnpm typecheck:turbo`: Type-check all packages.
- `pnpm lint` / `pnpm format`: Fix lint issues / apply Prettier.
Notes: native and security prep steps run via pre-scripts (`native:build`, `security:prepare`). Trial/Pro is now runtime-only; no separate `NODE_ENV=trial` build.

## Coding Style & Naming Conventions
- TypeScript, React, ESM. Prettier (`.prettierrc.mjs`) controls formatting; run `pnpm format`.
- ESLint config: `eslint-config-hyoban` with repo-specific rules; run `pnpm lint`.
- File names: components `PascalCase.tsx`; modules/utilities `kebab-case.ts`.
- Tailwind CSS v4; prefer utility classes over ad‑hoc CSS.

## Testing Guidelines
- No formal unit test suite yet. Required checks: `pnpm typecheck:turbo` and `pnpm lint`.
- Manual QA: run `pnpm dev:electron` and verify flows in both Electron and browser preview when relevant.
- i18n JSON is validated by ESLint rules; fix violations before PR.
- When adding translation keys, avoid creating both a parent key and child keys with the same prefix (e.g. `foo.bar` and `foo.bar.baz`). Use a dedicated leaf such as `foo.bar.default` if you need a base message.

## Commit & Pull Request Guidelines
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `style:`, `chore:`…
- PRs must include: concise description, linked issues (`Closes #123`), platform scope (Win/macOS/Linux), and screenshots/video for UI changes.
- Keep changes scoped; update docs and `.env.example` when adding config.

## Security & Configuration
- Copy `.env.example` to `.env` for local setup. Avoid committing secrets.
- Production builds may enable obfuscation via `SECURITY_OBFUSCATION=1`.

## Agent-Specific Notes
- See CLAUDE guidelines at `./CLAUDE.md` for automation and agent workflows.
- Follow @./CLAUDE.md rules
- Settings modal: app-specific tabs are `appearance`, `appPreferences`, and `appConnection`; `appConnection` is web-only, servers tab is Electron-only.
- Path mapping UI (Servers tab) uses `PathMappingModal` via `Modal.present` for add/edit; list rows are compact with drag handles, inline enable switch, and edit/delete icons.
- Complex feature modules (e.g. Discover modal) must follow the "Zustand store + singleton actions" pattern: keep pure state in `store.ts`, expose business logic through a global `*Actions` singleton, and have UI subscribe via selectors and call actions; reference `docs/store-actions-pattern.md` for details.
