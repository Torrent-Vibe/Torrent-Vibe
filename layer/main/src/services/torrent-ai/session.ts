import type { AgentMessage, AgentTool } from '@earendil-works/pi-agent-core'
import { Agent } from '@earendil-works/pi-agent-core'
import { BaseFirstUserContentProvider } from '@innei/message-engine'
import {
  createPiMessageEngine,
  createPiSystemPromptBridge,
} from '@innei/message-engine/adapters/pi'
import type { AiTraceExportTool } from '@torrent-vibe/shared'
import { truncateAiTracePreview } from '@torrent-vibe/shared'

import { getLogger } from '~/config/log-config'

import { SUBMIT_METADATA_TOOL_NAME } from './agentTools/submitMetadataTool'
import { renderSystemPrompt } from './prompts'
import type { AiProviderRuntime } from './providers'
import { openRouterAppHeaders } from './providers/openrouter-provider'
import { loadSkillIndex, renderAvailableSkillsXml } from './skills'
import {
  extractAssistantText,
  extractSubmitMetadataArguments,
  hasSuccessfulSubmitMetadata,
} from './text'
import { getAiTraceSink, projectTurnSnapshot } from './trace'

const MAX_RETRY_DELAY_MS = 15_000
const logger = getLogger('[torrent-ai.trace]')

const serializeTools = (tools: AgentTool[]): AiTraceExportTool[] =>
  tools.map(tool => ({
    name: tool.name,
    label: tool.label,
    description: tool.description,
    parameters: tool.parameters,
  }))

const sanitizeExportValue = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeExportValue(item))
  }
  const record = value as Record<string, unknown>
  if (record.type === 'image') {
    return { type: 'image', omitted: true }
  }
  const next: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(record)) {
    if (key === 'apiKey' || key === 'authorization' || key === 'cookie') {
      continue
    }
    next[key] = sanitizeExportValue(entry)
  }
  return next
}

class SkillCatalogProvider extends BaseFirstUserContentProvider {
  readonly id = 'torrent-ai.skill-catalog'
  constructor(private readonly catalog: string) {
    super({ sourceType: 'skill' })
  }

  protected build(): string | null {
    return this.catalog || null
  }
}

class FileTreeProvider extends BaseFirstUserContentProvider {
  readonly id = 'torrent-ai.file-tree'
  constructor(private readonly summary: string | null) {
    super({ sourceType: 'document' })
  }

  protected build(): string | null {
    return this.summary
  }
}

const headerValue = (
  headers: Record<string, string>,
  name: string,
): string | undefined => {
  const target = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value
    }
  }
  return undefined
}

const parseRetryAfterMs = (
  headers: Record<string, string>,
): number | undefined => {
  const retryAfterMs = headerValue(headers, 'retry-after-ms')
  if (retryAfterMs) {
    const parsed = Number(retryAfterMs)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.min(parsed, MAX_RETRY_DELAY_MS)
    }
  }
  const retryAfter = headerValue(headers, 'retry-after')
  if (!retryAfter) {
    return undefined
  }
  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS)
  }
  const date = Date.parse(retryAfter)
  if (Number.isNaN(date)) {
    return undefined
  }
  return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_DELAY_MS)
}

export async function runAnalysisAgent(input: {
  runtime: AiProviderRuntime
  userPrompt: string
  fileTreeSummary?: string | null
  tools: AgentTool[]
  sessionId: string
  runId: string
}): Promise<{ text: string, payload: unknown | null, errorMessage?: string }> {
  const skillIndex = loadSkillIndex()
  const catalog = renderAvailableSkillsXml(skillIndex)
  const systemPrompt = [
    renderSystemPrompt(),
    'available_skills is the project capability catalog; each description says when to use it. Load a full skill with read_skill when needed.',
    `When finished, call ${SUBMIT_METADATA_TOOL_NAME} once with the complete result. Call it alone as the last action. Do not print JSON as assistant text.`,
  ].join('\n\n')

  const sink = getAiTraceSink()
  sink.initExport(input.runId, {
    prompt: {
      system: systemPrompt,
      user: input.userPrompt,
      fileTree: input.fileTreeSummary ?? null,
      skillCatalog: catalog,
    },
    tools: serializeTools(input.tools),
  })
  let turns = 0
  let lastTurnId = `${input.sessionId}:0`
  let usageWarned = false
  let lastCacheBroke: { processorId?: string, reason: string } | undefined
  const toolStartedAt = new Map<string, number>()
  let retryPending = false
  let retryAttempt = 0

  const engine = createPiMessageEngine({
    initial: { agentId: 'torrent-ai' },
    services: {},
    sessionId: input.sessionId,
    strict: true,
    baseSystemPrompt: systemPrompt,
    tokenAccounting: {
      tokenizer: {
        id: 'estimate/chars-div-4',
        accuracy: 'estimated',
        count: content => Math.max(0, Math.ceil(content.length / 4)),
      },
      retainTurns: 50,
    },
    hooks: {
      onPrefixMutation(event) {
        lastCacheBroke = {
          ...(event.processorId ? { processorId: event.processorId } : {}),
          reason: event.reason,
        }
        sink.emit({
          type: 'cache_broke',
          runId: input.runId,
          ts: Date.now(),
          callIndex: turns,
          ...(event.processorId ? { processorId: event.processorId } : {}),
          reason: event.reason,
          firstChangedIndex: event.firstChangedIndex,
        })
      },
    },
    modules: [
      {
        id: 'torrent-ai',
        processors: [
          new SkillCatalogProvider(catalog),
          new FileTreeProvider(input.fileTreeSummary ?? null),
        ],
      },
    ],
  })

  const systemPromptBridge = createPiSystemPromptBridge(systemPrompt)

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model: input.runtime.model,
      thinkingLevel: 'minimal',
      tools: input.tools,
      messages: [],
    },
    sessionId: input.sessionId,
    toolExecution: 'parallel',
    streamFn: (model, context, options) =>
      input.runtime.models.streamSimple(
        model,
        systemPromptBridge.apply(context),
        {
          ...options,
          ...(input.runtime.apiKey ? { apiKey: input.runtime.apiKey } : {}),
          sessionId: input.sessionId,
          reasoning: 'minimal',
          maxRetries: 2,
          maxRetryDelayMs: MAX_RETRY_DELAY_MS,
          headers: {
            ...(input.runtime.id === 'openrouter'
              ? openRouterAppHeaders()
              : {}),
            'x-session-id': input.sessionId,
          },
          onResponse: async (response, responseModel) => {
            await options?.onResponse?.(response, responseModel)
            const retryAfterMs = parseRetryAfterMs(response.headers)
            const remaining
              = headerValue(response.headers, 'x-ratelimit-remaining')
                ?? headerValue(response.headers, 'x-ratelimit-remaining-requests')
            const reset
              = headerValue(response.headers, 'x-ratelimit-reset')
                ?? headerValue(response.headers, 'x-ratelimit-reset-requests')
            if (retryAfterMs != null || remaining != null || reset != null) {
              sink.emit({
                type: 'rate_limit',
                runId: input.runId,
                ts: Date.now(),
                callIndex: turns,
                ...(retryAfterMs == null ? {} : { retryAfterMs }),
                ...(remaining == null ? {} : { remaining }),
                ...(reset == null ? {} : { reset }),
              })
            }
            if (response.status === 429) {
              retryPending = true
              retryAttempt += 1
              sink.emit({
                type: 'retry_scheduled',
                runId: input.runId,
                ts: Date.now(),
                callIndex: turns,
                attempt: retryAttempt,
                maxAttempts: 2,
                delayMs: retryAfterMs ?? 0,
                errorMessage: truncateAiTracePreview(
                  `429${retryAfterMs == null ? '' : ` retry-after ${retryAfterMs}ms`}`,
                ),
              })
              return
            }
            if (retryPending) {
              retryPending = false
              sink.emit({
                type: 'retry_attempt',
                runId: input.runId,
                ts: Date.now(),
                callIndex: turns,
                attempt: retryAttempt,
              })
            }
          },
        },
      ),
    transformContext: engine.createTransformContext({
      runtime: {
        provider: input.runtime.id,
        model: input.runtime.modelId,
      },
      turnId: () => `${input.sessionId}:${++turns}`,
      step: () => ({ iteration: turns }),
      onCompiled: (result) => {
        systemPromptBridge.capture(result)
        lastTurnId
          = result.tokenSnapshot?.turnId ?? `${input.sessionId}:${turns}`
        sink.addCompiledCall(input.runId, {
          callIndex: turns,
          systemPrompt: result.systemPrompt,
        })
        if (result.tokenSnapshot) {
          sink.emit({
            type: 'call_compiled',
            runId: input.runId,
            ts: Date.now(),
            callIndex: turns,
            snapshot: projectTurnSnapshot(result.tokenSnapshot, {
              callIndex: turns,
              cacheBroke: Boolean(lastCacheBroke),
              ...(lastCacheBroke?.processorId
                ? { brokeAt: lastCacheBroke.processorId }
                : lastCacheBroke
                  ? { brokeAt: lastCacheBroke.reason }
                  : {}),
            }),
          })
          lastCacheBroke = undefined
        }
      },
    }),
    shouldStopAfterTurn: ({ toolResults }) =>
      turns >= 50 || hasSuccessfulSubmitMetadata(toolResults),
  })

  agent.subscribe(async (event) => {
    if (event.type === 'tool_execution_start') {
      toolStartedAt.set(event.toolCallId, Date.now())
      sink.addInvocation(input.runId, {
        callIndex: turns,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: sanitizeExportValue(event.args),
      })
      sink.emit({
        type: 'tool_start',
        runId: input.runId,
        ts: Date.now(),
        callIndex: turns,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        argsPreview: truncateAiTracePreview(event.args),
      })
      return
    }
    if (event.type === 'tool_execution_end') {
      const started = toolStartedAt.get(event.toolCallId)
      toolStartedAt.delete(event.toolCallId)
      sink.addInvocation(input.runId, {
        callIndex: turns,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: sanitizeExportValue(event.result),
        isError: event.isError,
        durationMs: started == null ? 0 : Date.now() - started,
      })
      sink.emit({
        type: 'tool_end',
        runId: input.runId,
        ts: Date.now(),
        callIndex: turns,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        isError: event.isError,
        durationMs: started == null ? 0 : Date.now() - started,
        resultPreview: truncateAiTracePreview(
          event.result?.content ?? event.result,
        ),
      })
      return
    }
    if (event.type !== 'message_end') {
      return
    }
    const message = event.message
    if (!message || typeof message !== 'object' || !('role' in message)) {
      return
    }
    if (
      message.role !== 'assistant'
      || !('usage' in message)
      || !message.usage
    ) {
      return
    }
    const usage = message.usage
    try {
      const snapshot = await engine.recordUsage(lastTurnId, {
        inputTokens: usage.input,
        outputTokens: usage.output,
        cacheReadTokens: usage.cacheRead,
        cacheWriteTokens: usage.cacheWrite,
        ...(usage.reasoning == null
          ? {}
          : { reasoningTokens: usage.reasoning }),
      })
      sink.emit({
        type: 'call_usage',
        runId: input.runId,
        ts: Date.now(),
        callIndex: turns,
        snapshot: projectTurnSnapshot(snapshot, { callIndex: turns }),
      })
    }
    catch (error) {
      if (!usageWarned) {
        usageWarned = true
        logger.warn('Failed to record token usage', {
          runId: input.runId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  })

  try {
    await agent.prompt(input.userPrompt)
    const messages = agent.state.messages as AgentMessage[]
    sink.setExportMessages(
      input.runId,
      sanitizeExportValue(messages) as unknown[],
    )
    return {
      text: extractAssistantText(messages),
      payload: extractSubmitMetadataArguments(messages),
      errorMessage: agent.state.errorMessage,
    }
  }
  finally {
    await engine.destroy()
  }
}
