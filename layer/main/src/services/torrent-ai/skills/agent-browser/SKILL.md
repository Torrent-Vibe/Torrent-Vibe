---
name: agent-browser
description: Use when a page must be opened, clicked, or extracted via the agent-browser CLI. Not for web search.
---

# agent-browser

Guidance only. There is no TypeScript wrapper. Search the web with `webSearch`. Use this skill when you need to inspect a specific URL after search.

## Install

```bash
npm i -g agent-browser && agent-browser install
```

The user may have set a custom CLI path in Settings → App Preferences.

## Core flow

```bash
agent-browser open <url>
agent-browser snapshot -i
agent-browser click @eN
agent-browser get text @eN
```

Use `agent-browser batch` for two or more sequential commands.

## Extract readable content

Prefer the page snapshot and targeted `get text`. Do not scrape search engine result pages with this CLI.
