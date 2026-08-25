import type {
  AgentChatContext,
  AgentChatRequest,
  AgentChatResponse,
  AgentChatSaveConversationRequest,
  AgentExecutePlanResult,
} from '@torrent-vibe/shared'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

import {
  AgentChatConversationDatabase,
  AgentChatEngine,
  agentTorrentOperations,
} from '../services/agent-chat'
import { BridgeService } from '../services/bridge-service'

const MAX_MESSAGE_LENGTH = 8_000
const MAX_CONVERSATION_ID_LENGTH = 100
const MAX_CONTEXT_VALUE_LENGTH = 200

const boundedStrings = (values: unknown, limit = 50): string[] =>
  Array.isArray(values)
    ? values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().slice(0, MAX_CONTEXT_VALUE_LENGTH))
        .filter(Boolean)
        .slice(0, limit)
    : []

const normalizeContext = (context: AgentChatContext): AgentChatContext => ({
  activeServerId:
    typeof context.activeServerId === 'string'
      ? context.activeServerId.trim().slice(0, MAX_CONVERSATION_ID_LENGTH) ||
        null
      : null,
  activeServerName:
    typeof context.activeServerName === 'string'
      ? context.activeServerName.trim().slice(0, MAX_CONTEXT_VALUE_LENGTH) ||
        null
      : null,
  capturedAt: Number.isFinite(context.capturedAt)
    ? Math.floor(context.capturedAt!)
    : Date.now(),
  filter: context.filter
    ? {
        categories: boundedStrings(context.filter.categories, 20),
        search:
          typeof context.filter.search === 'string'
            ? context.filter.search.trim().slice(0, 500)
            : '',
        statuses: boundedStrings(context.filter.statuses, 20),
        tags: boundedStrings(context.filter.tags, 20),
      }
    : undefined,
  locale:
    typeof context.locale === 'string'
      ? context.locale.trim().slice(0, 32) || 'en'
      : 'en',
  selectedTorrentHashes: boundedStrings(context.selectedTorrentHashes),
  visibleTorrentCount: Number.isFinite(context.visibleTorrentCount)
    ? Math.max(0, Math.floor(context.visibleTorrentCount))
    : 0,
})

export class AgentChatIPCService extends IpcService {
  static override readonly groupName = 'agentChat'

  private readonly engine = AgentChatEngine.getInstance()
  private readonly conversations = AgentChatConversationDatabase.getInstance()

  @IpcMethod()
  isAvailable(): boolean {
    return this.engine.isAvailable()
  }

  @IpcMethod()
  listConversations() {
    return this.conversations.list()
  }

  @IpcMethod()
  getConversation(payload: { conversationId: string }) {
    const conversationId = payload?.conversationId?.trim()
    if (!conversationId || conversationId.length > MAX_CONVERSATION_ID_LENGTH) {
      return null
    }
    return this.conversations.get(conversationId)
  }

  @IpcMethod()
  saveConversation(payload: AgentChatSaveConversationRequest) {
    const id = payload?.id?.trim()
    if (
      !id ||
      id.length > MAX_CONVERSATION_ID_LENGTH ||
      !Array.isArray(payload.messages)
    ) {
      return null
    }
    return this.conversations.save({ ...payload, id })
  }

  @IpcMethod()
  async deleteConversation(payload: { conversationId: string }) {
    const conversationId = payload?.conversationId?.trim()
    if (!conversationId || conversationId.length > MAX_CONVERSATION_ID_LENGTH) {
      return false
    }
    await this.conversations.delete(conversationId)
    return true
  }

  @IpcMethod()
  async sendMessage(payload: AgentChatRequest): Promise<AgentChatResponse> {
    const message = payload?.message?.trim()
    const runId = payload?.runId?.trim()
    const sessionId = payload?.sessionId?.trim()
    if (
      !message ||
      !runId ||
      !sessionId ||
      !payload.context ||
      !Array.isArray(payload.history) ||
      !Array.isArray(payload.context.selectedTorrentHashes)
    ) {
      return {
        activities: [],
        error: 'agent.invalidRequest',
        message: '',
        plans: [],
      }
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return {
        activities: [],
        error: 'agent.messageTooLong',
        message: '',
        plans: [],
      }
    }

    return this.engine.send(
      {
        ...payload,
        message,
        runId,
        sessionId,
        context: normalizeContext(payload.context),
        history: payload.history.slice(-16),
      },
      (event) => BridgeService.shared.broadcast('agent-chat:stream', event),
    )
  }

  @IpcMethod()
  cancel(payload: { sessionId: string }): void {
    const sessionId = payload?.sessionId?.trim()
    if (sessionId) {
      this.engine.cancel(sessionId)
    }
  }

  @IpcMethod()
  async executePlan(payload: {
    destructiveConfirmed?: boolean
    planId: string
  }): Promise<AgentExecutePlanResult> {
    const planId = payload?.planId?.trim()
    if (!planId) {
      return { ok: false, plan: null, error: 'Operation plan not found' }
    }
    return agentTorrentOperations.execute(
      planId,
      payload.destructiveConfirmed === true,
    )
  }
}
