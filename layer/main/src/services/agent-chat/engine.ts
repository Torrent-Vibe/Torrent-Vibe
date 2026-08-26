import type { AgentMessage } from '@earendil-works/pi-agent-core'
import { Agent } from '@earendil-works/pi-agent-core'
import type {
  AgentChatActivity,
  AgentChatMessageMetadata,
  AgentChatRequest,
  AgentChatResponse,
  AgentChatStreamEvent,
  AgentOperationPlan,
} from '@torrent-vibe/shared'

import { getLogger } from '../../config/log-config'
import { resolveAiProviderConfig } from '../torrent-ai/provider-config'
import type { AiProviderRuntime } from '../torrent-ai/providers'
import { selectProvider } from '../torrent-ai/providers'
import { openRouterAppHeaders } from '../torrent-ai/providers/openrouter-provider'
import { extractAssistantText } from '../torrent-ai/text'
import { extractActivityPayload, summarizeToolResult } from './activity-payload'
import { hasUngroundedPlanClaim } from './plan-grounding'
import { AgentChatStreamEmitter } from './stream-events'
import { renderSystemPrompt } from './system-prompt'
import { buildAgentChatTools } from './tools'
import { agentTorrentOperations } from './torrent-operations'

const MAX_HISTORY_MESSAGES = 16
const MAX_HISTORY_CONTENT_LENGTH = 4_000
const MAX_RETRY_DELAY_MS = 15_000
const logger = getLogger('[agent-chat]')

const emptyUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  },
}

const projectHistory = (
  input: AgentChatRequest,
  runtime: AiProviderRuntime,
): AgentMessage[] => {
  const now = Date.now() - input.history.length
  return input.history.slice(-MAX_HISTORY_MESSAGES).map((message, index) => {
    const content = message.content.slice(0, MAX_HISTORY_CONTENT_LENGTH)
    if (message.role === 'user') {
      return { role: 'user', content, timestamp: now + index }
    }
    return {
      role: 'assistant',
      content: [{ type: 'text', text: content }],
      api: runtime.model.api,
      provider: runtime.model.provider,
      model: runtime.model.id,
      usage: emptyUsage,
      stopReason: 'stop',
      timestamp: now + index,
    }
  })
}

export class AgentChatEngine {
  private static instance: AgentChatEngine | null = null
  private readonly activeAgents = new Map<string, Agent>()

  static getInstance(): AgentChatEngine {
    this.instance ??= new AgentChatEngine()
    return this.instance
  }

  isAvailable(): boolean {
    return Boolean(selectProvider(resolveAiProviderConfig()).runtime)
  }

  cancel(sessionId: string): void {
    this.activeAgents.get(sessionId)?.abort()
  }

  async send(
    input: AgentChatRequest,
    onEvent?: (event: AgentChatStreamEvent) => void,
  ): Promise<AgentChatResponse> {
    const selection = selectProvider(resolveAiProviderConfig())
    const runtime = selection.runtime
    if (!runtime) {
      return {
        activities: [],
        error: selection.error ?? 'ai.providers.unavailable',
        message: '',
        plans: [],
      }
    }

    this.activeAgents.get(input.sessionId)?.abort()

    const activities: AgentChatActivity[] = []
    const activityByCallId = new Map<string, AgentChatActivity>()
    const plans = new Map<string, AgentOperationPlan>()
    const systemPrompt = renderSystemPrompt(input)
    const startedAt = Date.now()
    const usage = {
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
    }
    const hasKnownCost = [
      runtime.model.cost,
      ...(runtime.model.cost.tiers ?? []),
    ].some(
      (rates) =>
        rates.input > 0 ||
        rates.output > 0 ||
        rates.cacheRead > 0 ||
        rates.cacheWrite > 0,
    )
    const emitter = new AgentChatStreamEmitter((event) => onEvent?.(event))
    let sequence = 0
    let turns = 0
    let firstTokenAt: number | undefined
    let generationMs = 0
    let generationStartedAt: number | undefined
    let model = runtime.modelId
    let stopReason: string | undefined

    const metadata = (completedAt?: number): AgentChatMessageMetadata => ({
      ...(completedAt
        ? { completedAt, durationMs: completedAt - startedAt }
        : {}),
      ...(firstTokenAt
        ? { firstTokenAt, ttftMs: firstTokenAt - startedAt }
        : {}),
      ...(generationMs > 0 && usage.outputTokens > 0
        ? { tokensPerSecond: usage.outputTokens / (generationMs / 1000) }
        : {}),
      generationMs,
      model,
      provider: runtime.id,
      startedAt,
      ...(stopReason ? { stopReason } : {}),
      usage: {
        ...usage,
        costUsd: hasKnownCost ? usage.costUsd : null,
      },
    })

    emitter.emit({
      metadata: metadata(),
      runId: input.runId,
      sequence: ++sequence,
      sessionId: input.sessionId,
      type: 'run-start',
    })

    const tools = buildAgentChatTools({
      context: input.context,
      operations: agentTorrentOperations,
      scopeKey: agentTorrentOperations.captureScope(
        input.context.activeServerId,
      ),
      sessionId: input.sessionId,
      userMessages: [
        ...input.history
          .filter((message) => message.role === 'user')
          .map((message) => message.content),
        input.message,
      ],
      onPlan: (plan) => {
        plans.set(plan.id, plan)
        emitter.emit({
          plan,
          runId: input.runId,
          sequence: ++sequence,
          sessionId: input.sessionId,
          type: 'plan',
        })
      },
    })
    const labels = new Map(tools.map((tool) => [tool.name, tool.label]))

    const agent = new Agent({
      initialState: {
        systemPrompt,
        model: runtime.model,
        thinkingLevel: 'minimal',
        tools,
        messages: projectHistory(input, runtime),
      },
      sessionId: input.sessionId,
      toolExecution: 'parallel',
      streamFn: (model, context, options) =>
        runtime.models.streamSimple(model, context, {
          ...options,
          ...(runtime.apiKey ? { apiKey: runtime.apiKey } : {}),
          sessionId: input.sessionId,
          reasoning: 'minimal',
          maxRetries: 2,
          maxRetryDelayMs: MAX_RETRY_DELAY_MS,
          headers: {
            ...(runtime.id === 'openrouter' ? openRouterAppHeaders() : {}),
            'x-session-id': input.sessionId,
          },
        }),
      shouldStopAfterTurn: () => turns >= 12,
    })

    agent.subscribe((event) => {
      if (
        event.type === 'message_start' &&
        event.message.role === 'assistant'
      ) {
        generationStartedAt = undefined
        emitter.emit({
          runId: input.runId,
          sequence: ++sequence,
          sessionId: input.sessionId,
          turn: turns,
          type: 'assistant-start',
        })
        return
      }
      if (event.type === 'message_update') {
        const update = event.assistantMessageEvent
        if ('delta' in update && update.delta) {
          const now = Date.now()
          firstTokenAt ??= now
          generationStartedAt ??= now
        }
        if (update.type === 'text_delta') {
          emitter.push({
            contentIndex: update.contentIndex,
            delta: update.delta,
            runId: input.runId,
            sequence: ++sequence,
            sessionId: input.sessionId,
            turn: turns,
            type: 'text-delta',
          })
        } else if (update.type === 'thinking_delta') {
          emitter.push({
            contentIndex: update.contentIndex,
            delta: update.delta,
            runId: input.runId,
            sequence: ++sequence,
            sessionId: input.sessionId,
            turn: turns,
            type: 'reasoning-delta',
          })
        }
        return
      }
      if (event.type === 'message_end' && event.message.role === 'assistant') {
        const endedAt = Date.now()
        if (generationStartedAt) {
          generationMs += endedAt - generationStartedAt
          generationStartedAt = undefined
        }
        const messageUsage = event.message.usage
        usage.inputTokens += messageUsage.input
        usage.outputTokens += messageUsage.output
        usage.cacheReadTokens += messageUsage.cacheRead
        usage.cacheWriteTokens += messageUsage.cacheWrite
        usage.reasoningTokens += messageUsage.reasoning ?? 0
        usage.totalTokens += messageUsage.totalTokens
        usage.costUsd += messageUsage.cost.total
        model = event.message.responseModel ?? event.message.model
        stopReason = event.message.stopReason
        return
      }
      if (event.type === 'turn_end') {
        turns += 1
        return
      }
      if (event.type === 'tool_execution_start') {
        const activity: AgentChatActivity = {
          id: event.toolCallId,
          label: labels.get(event.toolName) ?? event.toolName,
          status: 'running',
          toolName: event.toolName,
        }
        activities.push(activity)
        activityByCallId.set(event.toolCallId, activity)
        emitter.emit({
          activity: { ...activity },
          runId: input.runId,
          sequence: ++sequence,
          sessionId: input.sessionId,
          type: 'activity',
        })
        return
      }
      if (event.type === 'tool_execution_end') {
        const activity = activityByCallId.get(event.toolCallId)
        if (!activity) {
          return
        }
        activity.status = event.isError ? 'failed' : 'succeeded'
        activity.payload = extractActivityPayload(event.result)
        activity.summary = summarizeToolResult(event.result)
        emitter.emit({
          activity: { ...activity },
          runId: input.runId,
          sequence: ++sequence,
          sessionId: input.sessionId,
          type: 'activity',
        })
      }
    })

    this.activeAgents.set(input.sessionId, agent)
    try {
      let response: AgentChatResponse
      try {
        await agent.prompt(input.message)
        if (
          hasUngroundedPlanClaim(
            extractAssistantText(agent.state.messages),
            plans.size,
          )
        ) {
          await agent.prompt(
            'Your previous answer claimed a plan without calling prepare_torrent_operation. Retry the original request now and call the tool before saying a plan exists.',
          )
        }
        const error = agent.state.errorMessage
        response = {
          activities,
          ...(error ? { error } : {}),
          message: extractAssistantText(agent.state.messages),
          model,
          plans: [...plans.values()],
          provider: runtime.id,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Agent chat failed', { error: message })
        response = {
          activities,
          error: message,
          message: extractAssistantText(agent.state.messages),
          model,
          plans: [...plans.values()],
          provider: runtime.id,
        }
      }

      if (hasUngroundedPlanClaim(response.message, response.plans.length)) {
        response.error ??= 'agent.error.operationFailed'
        response.message = input.context.locale.startsWith('zh')
          ? '未能创建可确认的操作计划，队列没有发生变化。请重试。'
          : 'No reviewable operation plan was created, so the queue was not changed. Please try again.'
      }

      response.metadata = metadata(Date.now())
      emitter.emit({
        response,
        runId: input.runId,
        sequence: ++sequence,
        sessionId: input.sessionId,
        type: 'run-end',
      })
      return response
    } finally {
      emitter.flush()
      if (this.activeAgents.get(input.sessionId) === agent) {
        this.activeAgents.delete(input.sessionId)
      }
    }
  }
}
