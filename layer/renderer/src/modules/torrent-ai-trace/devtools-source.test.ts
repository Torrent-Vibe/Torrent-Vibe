import type { TurnTokenSnapshot } from '@innei/message-engine'
import type { AiCallSnapshot, AiTraceRun } from '@torrent-vibe/shared'
import { describe, expect, it } from 'vitest'

import { toMessageEngineTraceRun } from './devtools-source'

const makeProjectedSnapshot = (
  tokenSnapshot?: TurnTokenSnapshot,
): AiCallSnapshot => ({
  cacheBroke: false,
  cacheHitTokens: 120,
  callIndex: 1,
  reprocessedTokens: 80,
  segments: [
    {
      cached: true,
      injected: false,
      source: 'system',
      tokens: 120,
    },
    {
      cached: false,
      injected: true,
      source: 'user',
      tokens: 80,
    },
  ],
  ...(tokenSnapshot ? { tokenSnapshot } : {}),
  totalTokens: 200,
  unchangedTokens: 0,
  usage: {
    cacheRead: 120,
    cacheWrite: 0,
    input: 80,
    output: 24,
  },
})

const makeRun = (snapshot: AiCallSnapshot): AiTraceRun => ({
  endedAt: 1700,
  events: [
    {
      model: 'gpt-5.6-luna',
      provider: 'openai-codex',
      rawName: 'The.Matrix.1999.2160p.REMUX',
      runId: 'run-1',
      sessionId: 'session-1',
      ts: 1000,
      type: 'run_start',
    },
    {
      callIndex: 1,
      runId: 'run-1',
      snapshot,
      ts: 1100,
      type: 'call_usage',
    },
    {
      argsPreview: '{"query":"The Matrix"}',
      callIndex: 1,
      runId: 'run-1',
      toolCallId: 'tool-1',
      toolName: 'tmdbSearch',
      ts: 1200,
      type: 'tool_start',
    },
    {
      callIndex: 1,
      durationMs: 83,
      isError: false,
      resultPreview: '1 result',
      runId: 'run-1',
      toolCallId: 'tool-1',
      toolName: 'tmdbSearch',
      ts: 1283,
      type: 'tool_end',
    },
    {
      durationMs: 700,
      ok: true,
      runId: 'run-1',
      ts: 1700,
      type: 'run_end',
    },
  ],
  model: 'gpt-5.6-luna',
  ok: true,
  provider: 'openai-codex',
  rawName: 'The.Matrix.1999.2160p.REMUX',
  runId: 'run-1',
  sessionId: 'session-1',
  startedAt: 1000,
})

describe('toMessageEngineTraceRun', () => {
  it('preserves native telemetry and collapses a tool lifecycle into one activity', () => {
    const tokenSnapshot: TurnTokenSnapshot = {
      cache: {
        internalPrefixReuseRatio: 0,
        providerCacheHitRate: 0.6,
        uncachedInputTokens: 80,
      },
      createdAt: 1100,
      generation: 1,
      runtime: { model: 'gpt-5.6-luna', provider: 'openai-codex' },
      segments: [
        {
          accuracy: 'estimated',
          cacheScope: 'session',
          cacheStatus: 'provider-cache-read',
          characters: 480,
          contentDigest: 'system',
          framingType: 'system',
          moduleId: 'torrent-ai',
          percentage: 0.6,
          processorId: 'system',
          segmentId: 'system-1',
          sourceType: 'system',
          tokens: 120,
        },
      ],
      sessionId: 'session-1',
      totalCharacters: 480,
      totalTokens: 120,
      turnId: 'session-1:1',
      usage: {
        cacheReadTokens: 120,
        inputTokens: 80,
        outputTokens: 24,
      },
    }

    const result = toMessageEngineTraceRun(
      makeRun(makeProjectedSnapshot(tokenSnapshot)),
    )

    expect(result.status).toBe('success')
    expect(result.summary.turns).toEqual([tokenSnapshot])
    expect(result.summary.averageProviderCacheHitRate).toBe(0.6)
    expect(result.activities).toHaveLength(1)
    expect(result.activities[0]).toMatchObject({
      detail: '1 result',
      durationMs: 83,
      label: 'tmdbSearch',
      status: 'success',
      turnId: 'session-1:1',
    })
  })

  it('keeps traces recorded before native telemetry was added viewable', () => {
    const result = toMessageEngineTraceRun(makeRun(makeProjectedSnapshot()))

    expect(result.summary.turns).toHaveLength(1)
    expect(result.summary.turns[0]).toMatchObject({
      sessionId: 'session-1',
      totalTokens: 200,
      turnId: 'session-1:1',
      usage: {
        cacheReadTokens: 120,
        inputTokens: 80,
        outputTokens: 24,
      },
    })
    expect(result.summary.turns[0]?.segments).toHaveLength(2)
  })
})
