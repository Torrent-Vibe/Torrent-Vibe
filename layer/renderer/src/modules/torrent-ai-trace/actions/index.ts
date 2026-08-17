import type { AiTraceEvent, AiTraceRun } from '@torrent-vibe/shared'
import { AI_TRACE_RUN_LIMIT } from '@torrent-vibe/shared'

import { ipcServices } from '~/lib/ipc-client'

import { torrentAiTraceStore } from '../store'
import type { TorrentAiTraceActionResult } from '../types'

const applyEvent = (run: AiTraceRun, event: AiTraceEvent): void => {
  run.events.push(event)
  if (event.type === 'run_end') {
    run.endedAt = event.ts
    run.ok = event.ok
  }
}

const createRun = (event: AiTraceEvent): AiTraceRun => {
  if (event.type === 'run_start') {
    return {
      runId: event.runId,
      sessionId: event.sessionId,
      rawName: event.rawName,
      ...(event.hash ? { hash: event.hash } : {}),
      provider: event.provider,
      model: event.model,
      startedAt: event.ts,
      events: [event],
    }
  }
  return {
    runId: event.runId,
    sessionId: event.runId,
    rawName: '',
    provider: '',
    model: '',
    startedAt: event.ts,
    events: [event],
  }
}

const createTorrentAiTraceActions = () => {
  const findRunIdBySessionId = (sessionId: string): string | undefined => {
    const state = torrentAiTraceStore.getState()
    return state.runOrder.find(
      (runId) => state.runs[runId]?.sessionId === sessionId,
    )
  }

  const ingest = (event: AiTraceEvent) => {
    torrentAiTraceStore.setState((draft) => {
      let run = draft.runs[event.runId]
      if (!run) {
        run = createRun(event)
        draft.runs[event.runId] = run
        draft.runOrder.push(event.runId)
        while (draft.runOrder.length > AI_TRACE_RUN_LIMIT) {
          const evicted = draft.runOrder.shift()
          if (evicted) {
            delete draft.runs[evicted]
          }
        }
      } else {
        applyEvent(run, event)
      }
      if (!draft.selectedRunId || draft.selectedRunId === event.runId) {
        draft.selectedRunId = event.runId
      }
    })
  }

  const configure = async (): Promise<TorrentAiTraceActionResult> => {
    if (!ELECTRON) {
      return { ok: true }
    }
    try {
      const snapshot = await ipcServices?.torrentAi.getTraceSnapshot?.()
      const runs = snapshot?.runs ?? []
      torrentAiTraceStore.setState((draft) => {
        draft.runs = Object.fromEntries(runs.map((run) => [run.runId, run]))
        draft.runOrder = runs.map((run) => run.runId)
        draft.selectedRunId = runs.at(-1)?.runId ?? null
      })
      return { ok: true }
    } catch {
      return { ok: false, error: 'loadFailed' }
    }
  }

  const exportRun = async (
    runId: string,
  ): Promise<TorrentAiTraceActionResult<{ filePath?: string }>> => {
    try {
      const payload = await ipcServices?.torrentAi.getTraceExport?.({ runId })
      if (!payload) {
        return { ok: false, error: 'exportEmpty' }
      }
      const stamp = new Date().toISOString().replaceAll(':', '-')
      const safeName = payload.run.rawName
        .replaceAll(/[^\w.-]+/g, '-')
        .slice(0, 48)
      const filename = `torrent-ai-trace-${payload.run.runId}-${safeName || 'run'}-${stamp}.json`
      const content = `${JSON.stringify(payload, null, 2)}\n`
      const result = await ipcServices?.fileSystem.saveTextFile?.({
        title: 'Export AI trace',
        defaultPath: filename,
        filters: [
          { name: 'JSON', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        content,
      })
      if (!result || result.canceled) {
        return { ok: false, error: 'canceled' }
      }
      return { ok: true, data: { filePath: result.filePath } }
    } catch {
      return { ok: false, error: 'exportFailed' }
    }
  }

  return {
    configure,
    exportRun,
    exportSession: async (sessionId: string) => {
      const runId = findRunIdBySessionId(sessionId)
      if (!runId) {
        return { ok: false, error: 'runNotFound' }
      }
      return exportRun(runId)
    },
    ingest,
    selectRun: (runId: string | null) => {
      torrentAiTraceStore.setState((draft) => {
        draft.selectedRunId = runId
      })
    },
    selectSession: (sessionId: string) => {
      const runId = findRunIdBySessionId(sessionId)
      if (!runId) {
        return
      }
      torrentAiTraceStore.setState((draft) => {
        draft.selectedRunId = runId
      })
    },
  }
}

export const TorrentAiTraceActions = {
  shared: createTorrentAiTraceActions(),
} as const
