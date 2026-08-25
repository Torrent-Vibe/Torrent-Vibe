import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createWithEqualityFn } from 'zustand/traditional'

import type { AgentChatState } from './types'

const createInitialState = (): AgentChatState => ({
  activeRequestId: 0,
  activeRunId: null,
  conversations: [],
  draft: '',
  draftContext: null,
  error: null,
  historyLoaded: false,
  historyLoading: false,
  historyOpen: false,
  isDemo: false,
  isRunning: false,
  messages: [],
  panelHeight: 600,
  panelVisible: false,
  panelWidth: 440,
  sessionId: crypto.randomUUID(),
})

export const useAgentChatStore = createWithEqualityFn<AgentChatState>()(
  subscribeWithSelector(immer(createInitialState)),
)

export const agentChatStore = {
  getState: useAgentChatStore.getState,
  setState: useAgentChatStore.setState,
  reset: () => {
    const {
      conversations,
      historyLoaded,
      panelHeight,
      panelVisible,
      panelWidth,
    } = useAgentChatStore.getState()
    useAgentChatStore.setState(
      {
        ...createInitialState(),
        conversations,
        historyLoaded,
        panelHeight,
        panelVisible,
        panelWidth,
      },
      true,
    )
  },
}
