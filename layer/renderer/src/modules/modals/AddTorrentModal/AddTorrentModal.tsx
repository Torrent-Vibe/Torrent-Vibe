import type { ModalComponent } from '~/components/ui/modal'
import { useMobile } from '~/hooks/common/useMobile'

import { AddTorrentModalDesktop } from './desktop/AddTorrentModalDesktop'
import { AddTorrentModalMobile } from './mobile/AddTorrentModalMobile'
import type { AddTorrentModalProps } from './shared/types'
import { useAddTorrentLogic } from './shared/useAddTorrentLogic'

export const AddTorrentModal: ModalComponent<AddTorrentModalProps> = (
  props,
) => {
  const isMobile = useMobile()
  const sharedLogic = useAddTorrentLogic(props)

  if (isMobile) {
    return <AddTorrentModalMobile {...sharedLogic} />
  }

  return <AddTorrentModalDesktop {...sharedLogic} />
}

AddTorrentModal.contentClassName = 'max-w-[95vw] lg:max-w-[840px]'
