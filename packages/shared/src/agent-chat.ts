export type AgentChatRole = 'assistant' | 'user'

export interface AgentChatHistoryMessage {
  content: string
  role: AgentChatRole
}

export interface AgentChatFilter {
  categories: string[]
  search: string
  statuses: string[]
  tags: string[]
}

export interface AgentChatContext {
  activeServerId: string | null
  activeServerName: string | null
  capturedAt?: number
  filter?: AgentChatFilter
  locale: string
  selectedTorrentHashes: string[]
  visibleTorrentCount: number
}

export type AgentTorrentOperation =
  | 'add_tags'
  | 'add_torrent'
  | 'move_torrent'
  | 'pause'
  | 'reannounce'
  | 'recheck'
  | 'remove_tags'
  | 'remove_torrent'
  | 'rename_torrent'
  | 'resume'
  | 'set_category'
  | 'set_download_limit'
  | 'set_share_limits'
  | 'set_upload_limit'

export type AgentOperationPlanStatus =
  | 'pending'
  | 'executing'
  | 'succeeded'
  | 'partially_failed'
  | 'failed'
  | 'expired'

export type AgentOperationTargetOutcome =
  'pending' | 'changed' | 'skipped' | 'failed'

export interface AgentOperationTarget {
  category?: string
  downloadLimitBytesPerSecond?: number
  error?: string
  hash: string
  name: string
  outcome?: AgentOperationTargetOutcome
  savePath?: string
  seedingTimeLimitMinutes?: number
  shareRatioLimit?: number
  state: string
  tags?: string[]
  uploadLimitBytesPerSecond?: number
}

export interface AgentOperationPlan {
  action: AgentTorrentOperation
  category?: string
  createdAt: number
  deleteFiles?: boolean
  error?: string
  expiresAt: number
  id: string
  limitBytesPerSecond?: number
  newName?: string
  savePath?: string
  seedingTimeLimitMinutes?: number
  serverName?: string
  shareRatioLimit?: number
  startPaused?: boolean
  status: AgentOperationPlanStatus
  tags?: string[]
  targets: AgentOperationTarget[]
}

export interface AgentChatActivity {
  id: string
  label: string
  status: 'running' | 'succeeded' | 'failed'
  summary?: string
  toolName: string
}

export interface AgentChatRequest {
  context: AgentChatContext
  history: AgentChatHistoryMessage[]
  message: string
  runId: string
  sessionId: string
}

export interface AgentChatTokenUsage {
  cacheReadTokens: number
  cacheWriteTokens: number
  costUsd: number | null
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  totalTokens: number
}

export interface AgentChatMessageMetadata {
  completedAt?: number
  durationMs?: number
  firstTokenAt?: number
  generationMs: number
  model: string
  provider: string
  startedAt: number
  stopReason?: string
  tokensPerSecond?: number
  ttftMs?: number
  usage: AgentChatTokenUsage
}

export interface AgentChatResponse {
  activities: AgentChatActivity[]
  error?: string
  message: string
  metadata?: AgentChatMessageMetadata
  model?: string
  plans: AgentOperationPlan[]
  provider?: string
}

export type AgentChatMessageStatus =
  'complete' | 'streaming' | 'cancelled' | 'error'

export interface AgentChatPersistedMessage {
  activities: AgentChatActivity[]
  content: string
  context?: AgentChatContext
  createdAt: number
  id: string
  metadata: AgentChatMessageMetadata | null
  plans: AgentOperationPlan[]
  reasoning: string
  role: AgentChatRole
  runId?: string
  status: AgentChatMessageStatus
}

export interface AgentChatConversationSummary {
  createdAt: number
  id: string
  messageCount: number
  title: string
  updatedAt: number
}

export interface AgentChatConversation extends AgentChatConversationSummary {
  messages: AgentChatPersistedMessage[]
}

export interface AgentChatSaveConversationRequest {
  createdAt: number
  id: string
  messages: AgentChatPersistedMessage[]
  title: string
}

interface AgentChatStreamEventBase {
  runId: string
  sequence: number
  sessionId: string
}

export type AgentChatStreamEvent = AgentChatStreamEventBase &
  (
    | {
        metadata: AgentChatMessageMetadata
        type: 'run-start'
      }
    | {
        turn: number
        type: 'assistant-start'
      }
    | {
        contentIndex: number
        delta: string
        turn: number
        type: 'text-delta' | 'reasoning-delta'
      }
    | {
        activity: AgentChatActivity
        type: 'activity'
      }
    | {
        plan: AgentOperationPlan
        type: 'plan'
      }
    | {
        response: AgentChatResponse
        type: 'run-end'
      }
  )

export interface AgentExecutePlanResult {
  error?: string
  ok: boolean
  plan: AgentOperationPlan | null
}
