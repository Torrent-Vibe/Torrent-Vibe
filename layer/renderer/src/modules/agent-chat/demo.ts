import type {
  AgentChatActivity,
  AgentChatMessageMetadata,
  AgentChatStreamEvent,
  AgentOperationPlan,
} from '@torrent-vibe/shared'

import type { AgentChatUiMessage } from './types'

type DemoEventPayload<T = AgentChatStreamEvent> = T extends AgentChatStreamEvent
  ? Omit<T, 'runId' | 'sequence' | 'sessionId'>
  : never

const contentChunks = [
  '## 队列概览\n\n',
  '当前共有 **12** 个种子，其中 2 个正在下载、9 个已完成、1 个暂停。\n\n',
  '| 状态 | 数量 |\n| --- | ---: |\n| 下载中 | 2 |\n| 已完成 | 9 |\n| 暂停 | 1 |\n\n',
  '### UI 测试内容\n\n- CJK 与 **Markdown**\n- 行内公式：$12 - 2 = 10$\n- 代码高亮：\n\n',
  '```ts\nconst active = torrents.filter((torrent) => torrent.progress < 1)\n```\n\n',
  '```mermaid\nflowchart LR\n  Queue --> Inspect\n  Inspect --> Summary\n```\n',
]

export const createAgentChatDemo = (sessionId: string, runId: string) => {
  const startedAt = Date.now()
  const activity: AgentChatActivity = {
    id: 'demo-query',
    label: 'Query torrents',
    status: 'running',
    toolName: 'query_torrents',
  }
  const completedActivity: AgentChatActivity = {
    ...activity,
    status: 'succeeded',
    summary: 'Returned 12 visible torrents without mutation.',
  }
  const plan: AgentOperationPlan = {
    action: 'pause',
    createdAt: startedAt,
    expiresAt: startedAt + 15 * 60_000,
    id: 'demo-plan',
    status: 'succeeded',
    targets: [
      {
        category: '',
        hash: 'demo-1',
        name: 'Example.Download.S01E01.mkv',
        outcome: 'changed',
        state: 'downloading',
        tags: [],
      },
      {
        category: '',
        hash: 'demo-2',
        name: 'Example.Download.S01E02.mkv',
        outcome: 'changed',
        state: 'downloading',
        tags: [],
      },
    ],
  }
  const metadata: AgentChatMessageMetadata = {
    completedAt: startedAt + 1_840,
    durationMs: 1_840,
    firstTokenAt: startedAt + 310,
    generationMs: 1_240,
    model: 'demo/streamdown-ui',
    provider: 'local-dev',
    startedAt,
    stopReason: 'stop',
    tokensPerSecond: 72.6,
    ttftMs: 310,
    usage: {
      cacheReadTokens: 128,
      cacheWriteTokens: 0,
      costUsd: 0.001234,
      inputTokens: 640,
      outputTokens: 90,
      reasoningTokens: 18,
      totalTokens: 858,
    },
  }
  const message = contentChunks.join('')
  let sequence = 0
  const event = (value: DemoEventPayload): AgentChatStreamEvent =>
    ({
      ...value,
      runId,
      sequence: ++sequence,
      sessionId,
    }) as AgentChatStreamEvent

  const messages: AgentChatUiMessage[] = [
    {
      activities: [],
      content:
        '展示一条完整的 Agent 消息，覆盖流式正文、工具、推理、计划和 metadata。',
      context: {
        activeServerId: 'demo-server',
        activeServerName: 'Local UI Demo',
        locale: 'zh-CN',
        selectedTorrentHashes: [],
        visibleTorrentCount: 12,
      },
      createdAt: startedAt,
      id: 'demo-user',
      lastSequence: 0,
      metadata: null,
      plans: [],
      reasoning: '',
      role: 'user',
      status: 'complete',
    },
    {
      activities: [],
      content: '',
      createdAt: startedAt + 1,
      id: 'demo-assistant',
      lastSequence: 0,
      metadata: null,
      plans: [],
      reasoning: '',
      role: 'assistant',
      runId,
      status: 'streaming',
    },
  ]

  const steps: Array<{ delay: number; event: AgentChatStreamEvent }> = [
    {
      delay: 80,
      event: event({
        metadata: {
          ...metadata,
          completedAt: undefined,
          durationMs: undefined,
        },
        type: 'run-start',
      }),
    },
    { delay: 80, event: event({ turn: 0, type: 'assistant-start' }) },
    { delay: 120, event: event({ activity, type: 'activity' }) },
    {
      delay: 180,
      event: event({
        contentIndex: 0,
        delta: '先读取队列投影，确认这只是本地 UI fixture。',
        turn: 0,
        type: 'reasoning-delta',
      }),
    },
    {
      delay: 180,
      event: event({ activity: completedActivity, type: 'activity' }),
    },
    ...contentChunks.map((delta) => ({
      delay: 160,
      event: event({ contentIndex: 0, delta, turn: 0, type: 'text-delta' }),
    })),
    { delay: 120, event: event({ plan, type: 'plan' }) },
    {
      delay: 160,
      event: event({
        response: {
          activities: [completedActivity],
          message,
          metadata,
          model: metadata.model,
          plans: [plan],
          provider: metadata.provider,
        },
        type: 'run-end',
      }),
    },
  ]

  return { messages, steps }
}
