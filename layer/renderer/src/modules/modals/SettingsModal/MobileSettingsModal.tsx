import type { ModalComponent } from '~/components/ui/modal'

import type { SettingsSection } from './configs'
import { MobileSettingsContainer } from './mobile'

export const MobileSettingsModal: ModalComponent<{ tab?: SettingsSection }> = ({
  dismiss,
  tab,
}) => {
  return <MobileSettingsContainer onClose={dismiss} initialTab={tab} />
}

// Mobile settings should take full screen
MobileSettingsModal.contentClassName =
  'w-full h-full max-w-none max-h-none rounded-none p-0 overflow-hidden'
