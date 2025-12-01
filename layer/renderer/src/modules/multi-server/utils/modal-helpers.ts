import { Modal } from '~/components/ui/modal/ModalManager'

import { ServerConfigModal } from '../components/ServerConfigModal'

// Utility functions for imperative modal usage
export const showAddServerModal = () => {
  return Modal.present(ServerConfigModal, { mode: 'add' as const })
}

export const showEditServerModal = (serverId: string) => {
  return Modal.present(ServerConfigModal, { mode: 'edit' as const, serverId })
}
