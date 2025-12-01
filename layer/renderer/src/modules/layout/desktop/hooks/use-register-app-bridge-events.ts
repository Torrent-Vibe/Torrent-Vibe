import { useBridgeEvent } from '~/hooks/common'
import { presentSettingsModal } from '~/modules/modals/SettingsModal'

/**
 * Register global bridge events used across the desktop layout.
 */
export const useRegisterAppBridgeEvents = (): void => {
  useBridgeEvent('settings:open', ({ tab }) => {
    presentSettingsModal({ tab })
  })
}
