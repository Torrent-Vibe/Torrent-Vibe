import type { AiTraceEvent, AiTraceRun } from '@torrent-vibe/shared'

export type TorrentAiTraceState = {
  selectedRunId: string | null
  runs: Record<string, AiTraceRun>
  runOrder: string[]
}

export type TorrentAiTraceActionResult<T = void> = {
  ok: boolean
  data?: T
  error?: string
}

export type { AiTraceEvent, AiTraceRun }
