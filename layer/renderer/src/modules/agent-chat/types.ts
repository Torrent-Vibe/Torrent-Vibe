import type {
  AgentChatContext,
  AgentChatConversationSummary,
  AgentChatPersistedMessage,
} from '@torrent-vibe/shared'

export interface AgentChatUiMessage extends AgentChatPersistedMessage {
  lastSequence: number
}

export interface AgentChatState {
  activeRequestId: number
  activeRunId: string | null
  conversations: AgentChatConversationSummary[]
  draft: string
  draftContext: AgentChatContext | null
  error: string | null
  historyLoaded: boolean
  historyLoading: boolean
  historyOpen: boolean
  isDemo: boolean
  isRunning: boolean
  messages: AgentChatUiMessage[]
  panelHeight: number
  panelVisible: boolean
  panelWidth: number
  sessionId: string
}

export interface AgentChatActionResult<T = void> {
  data?: T
  error?: string
  ok: boolean
}
