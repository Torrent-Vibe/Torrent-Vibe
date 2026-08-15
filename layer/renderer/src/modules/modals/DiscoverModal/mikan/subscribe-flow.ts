import { Modal } from '~/components/ui/modal/ModalManager'

import { MikanSubscribeTargetsModal } from './MikanSubscribeTargetsModal'

export const presentSubscribeTargets = (options: {
  title?: string
  initialIds: string[]
  onConfirm: (serverIds: string[]) => void | Promise<void>
}) => {
  Modal.present(MikanSubscribeTargetsModal, options)
}
