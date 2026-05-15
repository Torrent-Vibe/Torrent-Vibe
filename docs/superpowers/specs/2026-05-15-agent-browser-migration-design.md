# Design: Migrate headless-Chrome data search to agent-browser CLI

- Date: 2026-05-15
- Status: Approved
- Topic: Replace the Puppeteer/headless-Chrome stack used by Torrent AI with the `vercel-labs/agent-browser` CLI

## Background

Torrent AI (`layer/main/src/services/torrent-ai/`) reaches the web through a
Puppeteer-driven headless Chrome:

- `manager/chrome-manager.ts` — launches a user-installed Chrome via
  `puppeteer-core` (a headless instance plus an interactive instance used to
  solve CAPTCHAs).
- `services/torrent-ai/search.ts` — navigates Google / DuckDuckGo and scrapes
  organic results with in-page extractor functions; falls back to an
  interactive CAPTCHA-solve flow when blocked.
- `services/torrent-ai/web-extract.ts` — opens a URL, serializes the DOM, and
  runs Mozilla Readability to extract article content.

These are exposed to the AI engine as tools (`googleSearch`,
`duckduckgoSearch`, `webExtractReadable`) via `services/torrent-ai/tools.ts`.

Pain points: requires the user to have Chrome installed and (optionally)
configured, and the Puppeteer launch/profile management is bespoke.

## Goals

- Replace the Puppeteer/headless-Chrome browser-driver layer with the
  `agent-browser` CLI (`vercel-labs/agent-browser`).
- Remove the `puppeteer-core` dependency entirely.
- Keep the existing Google/DuckDuckGo extractor logic and the Readability
  extraction logic — only the browser-driver layer changes.

## Non-goals

- Bundling the `agent-browser` binary with the app. The host machine must have
  the CLI installed (`npm i -g agent-browser && agent-browser install`); the
  app only invokes it.
- Preserving the interactive CAPTCHA-solve fallback. It is removed.
- Changing the AI engine, tool wiring shape, or the `native` (OpenAI web
  search) search mode.

## Approved decisions

1. **Scope**: replace both `search.ts` and `web-extract.ts`; remove the whole
   `puppeteer-core` / `chrome-manager.ts` stack.
2. **Distribution**: not bundled — the host installs the `agent-browser` CLI;
   the app spawns it.
3. **Settings**: convert the existing "Chrome integration" settings section
   into an "agent-browser CLI path" section; rename the stored key.
4. **Interactive CAPTCHA solve**: removed. On a block, return an error and let
   the AI engine switch engines or fall back to native web search.
5. **Implementation approach**: CLI subprocess + in-page `eval`. The extractor
   functions stay as in-page functions and are shipped to the page via
   `agent-browser eval -b <base64>` — the analogue of Puppeteer's
   `page.evaluate`.

## agent-browser facts relied on

- CLI + persistent native daemon; defaults to Chrome for Testing, which it
  downloads on `agent-browser install`.
- `agent-browser open <url>` — navigate.
- `agent-browser wait <selector>` / `wait --fn "<js>"` / `wait --load networkidle`
  — wait conditions.
- `agent-browser eval -b "<base64>"` — run arbitrary JS in the page and return
  the result; `--json` produces structured output.
- `agent-browser get url` / `get html <selector>` — page metadata / HTML.
- `agent-browser --user-agent "<UA>"` — global launch flag (placed before the
  subcommand).
- The daemon auto-starts on the first command.

## Architecture

### 1. `AgentBrowserManager` (main process)

New file `layer/main/src/manager/agent-browser-manager.ts`. Delete
`layer/main/src/manager/chrome-manager.ts`.

Responsibilities:

- **Locate the CLI**: prefer the configured `agentBrowserPath` setting; else
  resolve `agent-browser` on `PATH`.
- **`detectAgentBrowser()`**: resolve `agent-browser` on `PATH`, returning the
  absolute path — used by the Settings "auto-detect" button.
- **Execution**: run subcommands via `execFile(cli, args, { timeout })`; parse
  `--json` stdout. Global flags (e.g. `--user-agent`) go before the subcommand;
  `--json` goes after the subcommand.
- **High-level methods**:
  - `openAndEval<T>({ url, evalFn, waitFnCondition?, waitTimeoutMs?, userAgent? }): Promise<T>`
    — runs `open` → optional `wait --fn` → `eval -b <base64>`; returns the
    parsed eval result.
  - `getCurrentUrl(): Promise<string>` — `get url`.
  - `getPageHtml(): Promise<string>` — full document HTML (see Open question 2).
- **Concurrency**: an internal `ConcurrencyGate(1)` serializes every browser
  operation, because the daemon has a single shared "current tab". This
  replaces the old `searchConcurrencyGate(5)`.
- **Lifecycle**: on `app.on('before-quit')`, best-effort cleanup
  (`agent-browser close`). The daemon may linger; that is acceptable.
- **Errors**: `AgentBrowserNotFoundError` (CLI missing / configured path
  invalid) and `AgentBrowserError` (command failed, e.g. browser not installed,
  navigation/timeout failure).
- Move the `HEADLESS_USER_AGENT` constant here from `chrome-manager.ts`.

**Passing extractor functions to the page**: serialize with
`fn.toString()`, wrap as `(${fn.toString()})()`, base64-encode, pass via
`eval -b`. This requires the extractor to be self-contained (only page globals:
`document`, `window`, `URL`, `Set`, `Array`) — already true today, since
Puppeteer's `page.evaluate` imposes the same constraint.

Export a singleton (e.g. `agentBrowserManager`), mirroring the current
`chromeManager` export.

### 2. `search.ts`

- Remove: `runInteractiveSolve`, `interactiveSolveGate`, the `INTERACTIVE_*`
  constants, `searchConcurrencyGate` (concurrency now lives in the manager),
  and all `puppeteer-core` / `chrome-manager` imports.
- `executeHeadlessSearch`:
  - Build the search URL via `config.buildUrl` (unchanged).
  - Build a `waitFnCondition` from `config.waitSelectors` —
    `selectors.some(s => document.querySelector(s))`.
  - Call `agentBrowserManager.openAndEval({ url, userAgent: HEADLESS_USER_AGENT,
    waitFnCondition, waitTimeoutMs, evalFn: config.extractor })`.
  - Call `getCurrentUrl()` and run `config.detectBlock`. If blocked, return
    `{ ok: false, error: blockedKey }` — no interactive fallback.
  - Slice results to `maxResults`.
- The extractor functions (`googleExtractor`, `duckduckgoExtractor`) and the
  `SearchExtractor` type stay unchanged — they still execute in the page.
- `SEARCH_ENGINE_CONFIG[*].description`: change "Chrome-powered" wording to
  "browser-powered".
- Map failures to the new error keys (see §5).

### 3. `web-extract.ts`

- `extractReadableFromUrl`: replace the Puppeteer page work with
  `agentBrowserManager` — `open(url)` → `wait --load networkidle` → obtain full
  page HTML (see Open question 2) → `linkedom.parseHTML` → `Readability`.
- The `linkedom` + `@mozilla/readability` parsing half is unchanged; both
  dependencies are retained.
- Map failures to the new error keys (see §5).

### 4. Settings migration

| Location | Old | New |
|---|---|---|
| `layer/main/src/services/app-settings-store.ts` | `search.chromeExecutablePath`, `getChromeExecutablePath`, `setChromeExecutablePath` | `search.agentBrowserPath`, `getAgentBrowserPath`, `setAgentBrowserPath`. The old stored value is silently dropped (a Chrome path is meaningless for agent-browser). |
| `layer/main/src/ipc/app-settings.service.ts` | `setChromeExecutablePath`, `detectChromeExecutable`, `getSearchSettings` returns `chromeExecutablePath` | `setAgentBrowserPath`, `detectAgentBrowser`, `getSearchSettings` returns `agentBrowserPath`. Path validation (`notFound` / `notFile` / `notAccessible`) is retained — it validates the CLI path is an existing executable file. |
| `layer/renderer/src/modules/modals/SettingsModal/tabs/components/ChromeSearchSection.tsx` | — | Rename to `AgentBrowserSection.tsx`; update IPC calls, i18n keys, and the path placeholder (a CLI path, e.g. `/usr/local/bin/agent-browser`). |
| `layer/renderer/src/modules/modals/SettingsModal/tabs/components/index.ts` | exports `ChromeSearchSection` | exports `AgentBrowserSection` |
| `layer/renderer/src/modules/modals/SettingsModal/tabs/GeneralTab.tsx` | renders `<ChromeSearchSection />` | renders `<AgentBrowserSection />` |
| `layer/renderer/src/modules/settings-data-management/app-settings-data.ts` | schema + import/export of `chromeExecutablePath` | `agentBrowserPath` |

### 5. Errors & i18n

`layer/main/src/services/torrent-ai/tools.ts`:

- Rename the exported `detectChromeExecutable` to `detectAgentBrowser`.
- Update the `webExtractReadable` tool description ("headless Chrome" →
  "agent-browser").

`locales/setting/{en,zh-CN}.json` — replace the `desktop.chromeSearch.*` flat
keys with `desktop.agentBrowser.*`:

- `desktop.agentBrowser.title`, `.description`
- `.path.label` ("agent-browser CLI path"), `.path.description`,
  `.path.placeholder`
- `.actions.label/help/detect/detecting/save/saving/clear`
- `.messages.detectFailed/detectFailedWithReason/detected/pathMissing/`
  `pathNotFile/pathNotAccessible/saveFailed/saveFailedWithReason/saved`
- The `detectFailed` copy should guide the user to install the CLI
  (`npm i -g agent-browser && agent-browser install`).

`locales/app/{en,zh-CN}.json` — AI error keys:

- `ai.search.chromeNotFound` → `ai.search.agentBrowserNotFound`
- `ai.search.chromeLaunchFailed` + `ai.search.chromePageFailed` → a single
  `ai.search.agentBrowserFailed`
- `ai.webExtract.chromeNotFound` → `ai.webExtract.agentBrowserNotFound`
- `ai.webExtract.chromeLaunchFailed` + `ai.webExtract.chromePageFailed` → a
  single `ai.webExtract.agentBrowserFailed`
- `ai.google.blocked` / `ai.duckduckgo.blocked` — retained, but the copy drops
  the "manual verification required" phrasing (the interactive solve is gone);
  reword to suggest retrying later or switching engines.
- `ai.{google,duckduckgo}.navigationFailed` / `.parseFailed`,
  `ai.webExtract.navigationFailed` / `.parseFailed` / `.timeout` — retained.
- `solveVerification.*` keys: none currently exist in the locale files, so no
  removal needed; the `i18n.t('ai.search.solveVerification.*')` calls simply
  disappear with `runInteractiveSolve`.

### 6. Dependency & file changes

`layer/main/package.json`: remove `puppeteer-core`. Keep `@mozilla/readability`
and `linkedom` (still used by `web-extract.ts`).

| Action | File |
|---|---|
| Delete | `layer/main/src/manager/chrome-manager.ts` |
| New | `layer/main/src/manager/agent-browser-manager.ts` |
| Edit | `layer/main/src/services/torrent-ai/search.ts` |
| Edit | `layer/main/src/services/torrent-ai/web-extract.ts` |
| Edit | `layer/main/src/services/torrent-ai/tools.ts` |
| Edit | `layer/main/src/ipc/app-settings.service.ts` |
| Edit | `layer/main/src/services/app-settings-store.ts` |
| Edit | `layer/main/package.json` |
| Rename + edit | `ChromeSearchSection.tsx` → `AgentBrowserSection.tsx` |
| Edit | `SettingsModal/tabs/components/index.ts` |
| Edit | `SettingsModal/tabs/GeneralTab.tsx` |
| Edit | `layer/renderer/src/modules/settings-data-management/app-settings-data.ts` |
| Edit | `locales/setting/en.json`, `locales/setting/zh-CN.json` |
| Edit | `locales/app/en.json`, `locales/app/zh-CN.json` |

Before finishing, grep for any remaining references to `chromeManager`,
`ChromeManager`, `detectChromeExecutable`, `chromeExecutablePath`,
`puppeteer`, `chrome-manager` across `layer/` (excluding `dist/`) and resolve
them.

## Open questions (verify against the real CLI during implementation; not blocking)

1. The exact JSON path of the `eval --json` result envelope (e.g.
   `data.result` vs `data.value`). Confirm by running the CLI and adapt the
   parser in `AgentBrowserManager`.
2. The exact command to obtain the full-page HTML document for Readability.
   Working assumption: `eval -b` of `document.documentElement.outerHTML`.
   Alternative: `get html` against the root element. Pick whichever the CLI
   supports cleanly.

## Testing

- `pnpm typecheck:main` and `pnpm typecheck:renderer` pass.
- Lint only the changed files.
- Manual smoke test: run a Torrent AI analysis and confirm that Google /
  DuckDuckGo search and `webExtractReadable` all succeed through agent-browser.
- Negative path: with the CLI absent / path misconfigured, confirm
  `agentBrowserNotFound` surfaces with the guidance copy.
