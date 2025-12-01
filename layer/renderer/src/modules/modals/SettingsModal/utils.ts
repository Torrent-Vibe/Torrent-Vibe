import { Modal } from '~/components/ui/modal/ModalManager'
import { isMobile } from '~/hooks/common/useMobile'

import type { SettingsSection } from './configs'
import { MobileSettingsModal } from './MobileSettingsModal'
import { SettingsModal } from './SettingsModal'

/**
 * Present the appropriate settings modal based on the current device type
 * - Desktop: Shows SettingsModal with sidebar navigation
 * - Mobile: Shows MobileSettingsModal with stack navigation
 */
export const presentSettingsModal = (options?: { tab: SettingsSection }) => {
  if (isMobile()) {
    Modal.present(MobileSettingsModal, options)
  } else {
    Modal.present(SettingsModal, options)
  }
}

// Export both modals for direct use if needed

export { MobileSettingsModal } from './MobileSettingsModal'
export { SettingsModal } from './SettingsModal'
