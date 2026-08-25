import { useBridgeEvent } from '~/hooks/common'
import { AgentChatActions } from '~/modules/agent-chat/actions'
import { presentSettingsModal } from '~/modules/modals/SettingsModal'

/**
 * Register global bridge events used across the desktop layout.
 */
export const useRegisterAppBridgeEvents = (): void => {
  useBridgeEvent('agent-chat:stream', (event) => {
    AgentChatActions.shared.handleStreamEvent(event)
  })

  useBridgeEvent('settings:open', ({ tab }) => {
    presentSettingsModal({ tab })
  })
}
