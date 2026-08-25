import type {
  AgentChatConversation,
  AgentChatConversationSummary,
  AgentChatHistoryMessage,
  AgentChatPersistedMessage,
  AgentChatResponse,
  AgentChatStreamEvent,
  AgentExecutePlanResult,
} from '@torrent-vibe/shared'

import { getI18n } from '~/i18n'
import { ipcServices } from '~/lib/ipc-client'
import { TorrentActions } from '~/modules/torrent/stores/torrent-actions'
import { torrentDataStoreSetters } from '~/modules/torrent/stores/torrent-data-store'

import { captureAgentContext } from './context'
import { agentChatStore } from './store'
import type { AgentChatActionResult, AgentChatUiMessage } from './types'

const newMessageId = (): string => crypto.randomUUID()
const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

const applyResponse = (
  message: AgentChatUiMessage,
  response: AgentChatResponse,
): void => {
  message.activities = response.activities
  message.content = response.message || message.content
  message.metadata = response.metadata ?? message.metadata
  message.plans = response.plans
  message.status = response.error ? 'error' : 'complete'
}

const projectHistory = (
  messages: AgentChatUiMessage[],
): AgentChatHistoryMessage[] =>
  messages
    .filter((message) => message.content.trim())
    .map((message) => ({ role: message.role, content: message.content }))

const conversationTitle = (messages: AgentChatUiMessage[]): string =>
  messages
    .find((message) => message.role === 'user' && message.content.trim())
    ?.content.replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 60) || getI18n().t('agent.newChat')

const projectPersistedMessages = (
  messages: AgentChatUiMessage[],
): AgentChatPersistedMessage[] =>
  messages.map(({ lastSequence: _lastSequence, ...message }) => message)

const restoreConversationMessages = (
  conversation: AgentChatConversation,
): AgentChatUiMessage[] =>
  conversation.messages.map((message) => ({
    ...message,
    lastSequence: 0,
    status: message.status === 'streaming' ? 'cancelled' : message.status,
  }))

const upsertConversation = (
  conversations: AgentChatConversationSummary[],
  summary: AgentChatConversationSummary,
): void => {
  const index = conversations.findIndex(
    (conversation) => conversation.id === summary.id,
  )
  if (index >= 0) {
    conversations.splice(index, 1)
  }
  conversations.unshift(summary)
}

export class AgentChatActions {
  static readonly shared = new AgentChatActions()

  private demoGeneration = 0
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  private constructor() {}

  private schedulePersist(delay = 300): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      void this.persistCurrentConversation()
    }, delay)
  }

  private async persistCurrentConversation(): Promise<void> {
    const state = agentChatStore.getState()
    const service = ipcServices?.agentChat
    if (!ELECTRON || !service || state.isDemo || state.messages.length === 0) {
      return
    }

    try {
      const summary = await service.saveConversation({
        createdAt: state.messages[0]?.createdAt ?? Date.now(),
        id: state.sessionId,
        messages: projectPersistedMessages(state.messages),
        title: conversationTitle(state.messages),
      })
      if (!summary) {
        return
      }
      agentChatStore.setState((draft) => {
        upsertConversation(draft.conversations, summary)
        draft.historyLoaded = true
      })
    } catch (error) {
      agentChatStore.setState((draft) => {
        draft.error = error instanceof Error ? error.message : String(error)
      })
    }
  }

  setDraft(draft: string): void {
    agentChatStore.setState((state) => {
      state.draft = draft
    })
  }

  closePanel(): void {
    agentChatStore.setState((state) => {
      state.panelVisible = false
    })
  }

  openPanel(selectedTorrentHashes?: string[]): void {
    const state = agentChatStore.getState()
    const draftContext = selectedTorrentHashes
      ? captureAgentContext(selectedTorrentHashes)
      : null
    agentChatStore.setState((state) => {
      if (draftContext) {
        state.draftContext = draftContext
      }
      state.panelVisible = true
    })
    if (typeof document !== 'undefined') {
      setTimeout(() => {
        document
          .querySelector<HTMLTextAreaElement>('[data-agent-composer]')
          ?.focus()
      }, 100)
    }
    if (!state.historyLoaded && state.messages.length === 0 && !state.isDemo) {
      void this.restoreLatestConversation(
        state.sessionId,
        Boolean(draftContext),
      )
    }
  }

  removeDraftContextPart(
    part: 'filter' | 'search' | 'selection' | 'server',
  ): void {
    const current = structuredClone(
      agentChatStore.getState().draftContext ?? captureAgentContext(),
    )
    const filter = current.filter ?? {
      categories: [],
      search: '',
      statuses: [],
      tags: [],
    }

    if (part === 'server') {
      current.activeServerId = null
      current.activeServerName = null
    } else if (part === 'selection') {
      current.selectedTorrentHashes = []
    } else if (part === 'search') {
      filter.search = ''
      current.filter = filter
    } else {
      current.filter = { ...filter, categories: [], statuses: [], tags: [] }
    }

    const attachedFilter = current.filter
    const hasAttachment =
      current.selectedTorrentHashes.length > 0 ||
      Boolean(attachedFilter?.search) ||
      (attachedFilter?.categories?.length ?? 0) > 0 ||
      (attachedFilter?.statuses?.length ?? 0) > 0 ||
      (attachedFilter?.tags?.length ?? 0) > 0 ||
      current.activeServerId === null

    agentChatStore.setState((state) => {
      state.draftContext = hasAttachment ? current : null
    })
  }

  setPanelHeight(height: number): void {
    agentChatStore.setState((state) => {
      state.panelHeight = height
    })
  }

  setPanelWidth(width: number): void {
    agentChatStore.setState((state) => {
      state.panelWidth = width
    })
  }

  reset(): void {
    this.demoGeneration += 1
    void this.persistCurrentConversation()
    const { sessionId, isDemo, isRunning } = agentChatStore.getState()
    const service = ipcServices?.agentChat
    if (isRunning && !isDemo && service) {
      void service.cancel({ sessionId })
    }
    agentChatStore.reset()
  }

  async openHistory(): Promise<void> {
    if (agentChatStore.getState().isRunning) {
      return
    }
    agentChatStore.setState((state) => {
      state.historyOpen = true
    })
    await this.refreshHistory()
  }

  closeHistory(): void {
    agentChatStore.setState((state) => {
      state.historyOpen = false
    })
  }

  async loadConversation(
    conversationId: string,
    preserveDraftContext = false,
  ): Promise<void> {
    const service = ipcServices?.agentChat
    if (!ELECTRON || !service || agentChatStore.getState().isRunning) {
      return
    }
    agentChatStore.setState((state) => {
      state.historyLoading = true
    })
    try {
      const conversation = await service.getConversation({ conversationId })
      if (!conversation) {
        await this.refreshHistory()
        return
      }
      this.demoGeneration += 1
      agentChatStore.setState((state) => {
        state.activeRequestId += 1
        state.activeRunId = null
        state.draft = ''
        if (!preserveDraftContext) {
          state.draftContext = null
        }
        state.error = null
        state.historyLoaded = true
        state.historyLoading = false
        state.historyOpen = false
        state.isDemo = false
        state.isRunning = false
        state.messages = restoreConversationMessages(conversation)
        state.sessionId = conversation.id
      })
    } catch (error) {
      agentChatStore.setState((state) => {
        state.error = error instanceof Error ? error.message : String(error)
        state.historyLoading = false
      })
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const service = ipcServices?.agentChat
    if (!ELECTRON || !service) {
      return
    }
    const deleted = await service.deleteConversation({ conversationId })
    if (!deleted) {
      return
    }
    const isActive = agentChatStore.getState().sessionId === conversationId
    agentChatStore.setState((state) => {
      state.conversations = state.conversations.filter(
        (conversation) => conversation.id !== conversationId,
      )
    })
    if (isActive) {
      agentChatStore.reset()
    }
  }

  private async refreshHistory(): Promise<AgentChatConversationSummary[]> {
    const service = ipcServices?.agentChat
    if (!ELECTRON || !service) {
      agentChatStore.setState((state) => {
        state.historyLoaded = true
        state.historyLoading = false
      })
      return []
    }
    agentChatStore.setState((state) => {
      state.historyLoading = true
    })
    try {
      const conversations = await service.listConversations()
      agentChatStore.setState((state) => {
        state.conversations = conversations
        state.historyLoaded = true
        state.historyLoading = false
      })
      return conversations
    } catch (error) {
      agentChatStore.setState((state) => {
        state.error = error instanceof Error ? error.message : String(error)
        state.historyLoaded = true
        state.historyLoading = false
      })
      return []
    }
  }

  private async restoreLatestConversation(
    sessionId: string,
    preserveDraftContext: boolean,
  ): Promise<void> {
    const conversations = await this.refreshHistory()
    const latest = conversations[0]
    const state = agentChatStore.getState()
    if (
      latest &&
      state.sessionId === sessionId &&
      state.messages.length === 0 &&
      !state.isDemo
    ) {
      await this.loadConversation(latest.id, preserveDraftContext)
    }
  }

  cancel(): void {
    const state = agentChatStore.getState()
    if (!state.isRunning) {
      return
    }
    this.demoGeneration += 1
    const service = ipcServices?.agentChat
    if (!state.isDemo && service) {
      void service.cancel({ sessionId: state.sessionId })
    }
    agentChatStore.setState((draft) => {
      draft.activeRequestId += 1
      const message = draft.messages.find(
        (candidate) => candidate.runId === draft.activeRunId,
      )
      if (message?.status === 'streaming') {
        message.status = 'cancelled'
      }
      draft.activeRunId = null
      draft.isRunning = false
    })
    this.schedulePersist(0)
  }

  handleStreamEvent(event: AgentChatStreamEvent): void {
    let accepted = false
    agentChatStore.setState((state) => {
      if (
        event.sessionId !== state.sessionId ||
        event.runId !== state.activeRunId
      ) {
        return
      }
      const message = state.messages.find(
        (candidate) => candidate.runId === event.runId,
      )
      if (!message || event.sequence <= message.lastSequence) {
        return
      }
      accepted = true
      message.lastSequence = event.sequence

      switch (event.type) {
        case 'run-start': {
          message.metadata = event.metadata
          break
        }
        case 'assistant-start': {
          message.content = ''
          message.reasoning = ''
          break
        }
        case 'text-delta': {
          message.content += event.delta
          break
        }
        case 'reasoning-delta': {
          message.reasoning += event.delta
          break
        }
        case 'activity': {
          const index = message.activities.findIndex(
            (activity) => activity.id === event.activity.id,
          )
          if (index >= 0) {
            message.activities[index] = event.activity
          } else {
            message.activities.push(event.activity)
          }
          break
        }
        case 'plan': {
          const index = message.plans.findIndex(
            (plan) => plan.id === event.plan.id,
          )
          if (index >= 0) {
            message.plans[index] = event.plan
          } else {
            message.plans.push(event.plan)
          }
          break
        }
        case 'run-end': {
          applyResponse(message, event.response)
          state.activeRunId = null
          state.error = event.response.error ?? null
          state.isRunning = false
          break
        }
      }
    })
    if (accepted) {
      this.schedulePersist(event.type === 'run-end' ? 0 : 300)
    }
  }

  async send(messageOverride?: string): Promise<AgentChatActionResult> {
    const state = agentChatStore.getState()
    const message = (messageOverride ?? state.draft).trim()
    if (!message || state.isRunning) {
      return { ok: false, error: 'agent.invalidRequest' }
    }
    if (state.isDemo) {
      return { ok: false, error: 'agent.demo.noRequest' }
    }
    const service = ipcServices?.agentChat
    if (!ELECTRON || !service) {
      return { ok: false, error: 'agent.notSupported' }
    }

    const requestId = state.activeRequestId + 1
    const runId = crypto.randomUUID()
    const history = projectHistory(state.messages)
    const context = structuredClone(state.draftContext ?? captureAgentContext())
    agentChatStore.setState((draft) => {
      draft.activeRequestId = requestId
      draft.activeRunId = runId
      draft.draft = ''
      draft.draftContext = null
      draft.error = null
      draft.isRunning = true
      draft.messages.push({
        activities: [],
        content: message,
        context,
        createdAt: Date.now(),
        id: newMessageId(),
        lastSequence: 0,
        metadata: null,
        plans: [],
        reasoning: '',
        role: 'user',
        status: 'complete',
      })
      draft.messages.push({
        activities: [],
        content: '',
        createdAt: Date.now(),
        id: newMessageId(),
        lastSequence: 0,
        metadata: null,
        plans: [],
        reasoning: '',
        role: 'assistant',
        runId,
        status: 'streaming',
      })
    })
    this.schedulePersist(0)

    try {
      const response = await service.sendMessage({
        context,
        history,
        message,
        runId,
        sessionId: state.sessionId,
      })
      if (agentChatStore.getState().activeRequestId !== requestId) {
        return { ok: false, error: 'agent.cancelled' }
      }

      agentChatStore.setState((draft) => {
        const assistant = draft.messages.find(
          (candidate) => candidate.runId === runId,
        )
        if (assistant) {
          applyResponse(assistant, response)
        }
        draft.activeRunId = null
        draft.isRunning = false
        draft.error = response.error ?? null
      })
      this.schedulePersist(0)
      return response.error
        ? { ok: false, error: response.error }
        : { ok: true }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      if (agentChatStore.getState().activeRequestId === requestId) {
        agentChatStore.setState((draft) => {
          const assistant = draft.messages.find(
            (candidate) => candidate.runId === runId,
          )
          if (assistant) {
            assistant.status = 'error'
          }
          draft.activeRunId = null
          draft.isRunning = false
          draft.error = errorMessage
        })
        this.schedulePersist(0)
      }
      return { ok: false, error: errorMessage }
    }
  }

  async executePlan(
    planId: string,
    destructiveConfirmed = false,
  ): Promise<AgentChatActionResult<AgentExecutePlanResult>> {
    if (agentChatStore.getState().isDemo) {
      return { ok: false, error: 'agent.demo.noExecution' }
    }
    const service = ipcServices?.agentChat
    if (!ELECTRON || !service) {
      return { ok: false, error: 'agent.notSupported' }
    }
    agentChatStore.setState((state) => {
      for (const message of state.messages) {
        const plan = message.plans.find((candidate) => candidate.id === planId)
        if (plan?.status === 'pending') {
          plan.status = 'executing'
        }
      }
    })

    try {
      const result = await service.executePlan({
        destructiveConfirmed,
        planId,
      })
      agentChatStore.setState((state) => {
        for (const message of state.messages) {
          const index = message.plans.findIndex(
            (candidate) => candidate.id === planId,
          )
          if (index >= 0 && result.plan) {
            message.plans[index] = result.plan
          }
        }
        state.error = result.ok
          ? null
          : (result.error ?? 'agent.operationFailed')
      })
      if (
        result.ok ||
        result.plan?.targets.some((target) => target.outcome === 'changed')
      ) {
        if (result.plan?.action === 'remove_torrent') {
          torrentDataStoreSetters.clearSelection()
        }
        await TorrentActions.shared.fetchTorrents()
      }
      this.schedulePersist(0)
      return result.ok
        ? { ok: true, data: result }
        : { ok: false, data: result, error: result.error }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      agentChatStore.setState((state) => {
        state.error = errorMessage
        for (const message of state.messages) {
          const plan = message.plans.find(
            (candidate) => candidate.id === planId,
          )
          if (plan?.status === 'executing') {
            plan.status = 'failed'
            plan.error = errorMessage
          }
        }
      })
      this.schedulePersist(0)
      return { ok: false, error: errorMessage }
    }
  }

  async loadDemo(): Promise<void> {
    if (!import.meta.env.DEV) {
      return
    }
    this.cancel()
    const generation = ++this.demoGeneration
    const sessionId = `demo-${crypto.randomUUID()}`
    const runId = `demo-run-${crypto.randomUUID()}`
    const { createAgentChatDemo } = await import('./demo')
    if (generation !== this.demoGeneration) {
      return
    }
    const demo = createAgentChatDemo(sessionId, runId)
    agentChatStore.setState((state) => {
      state.activeRequestId += 1
      state.activeRunId = runId
      state.draft = ''
      state.error = null
      state.historyOpen = false
      state.isDemo = true
      state.isRunning = true
      state.messages = demo.messages
      state.panelVisible = true
      state.sessionId = sessionId
    })

    for (const step of demo.steps) {
      await wait(step.delay)
      if (generation !== this.demoGeneration) {
        return
      }
      this.handleStreamEvent(step.event)
    }
  }
}
