import { Modal } from '~/components/ui/modal/ModalManager'

import { AddTorrentModal } from './AddTorrentModal'

export const presentAddTorrentModal = (options?: {
  initialFiles?: File[]
  initialMagnetLinks?: string
}) => {
  Modal.present(AddTorrentModal, options)
}
