import { Modal } from '~/components/ui/modal/ModalManager'

import { MikanSubscribeTargetsModal } from './MikanSubscribeTargetsModal'

export const presentSubscribeTargets = (options: {
  allowEmpty?: boolean
  initialIds: string[]
  onConfirm: (serverIds: string[]) => void | Promise<void>
  title?: string
}) => {
  Modal.present(MikanSubscribeTargetsModal, options)
}
