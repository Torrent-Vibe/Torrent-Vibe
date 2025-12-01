import { toast } from 'sonner'

import type { DiscoverProviderId } from '~/atoms/settings/discover'
import { Modal } from '~/components/ui/modal/ModalManager'
import { getI18n } from '~/i18n'
import type { DiscoverItem, DiscoverItemDetail } from '~/modules/discover'
import { DiscoverService } from '~/modules/discover/service'
import type { TorrentFormData } from '~/modules/modals/AddTorrentModal'
import { createAddTorrentOptions } from '~/modules/modals/AddTorrentModal/shared/createAddTorrentOptions'
import { TorrentActions } from '~/modules/torrent/stores/torrent-actions'

import type { DiscoverImportItemSummary } from '../../ImportConfirmationModal'
import { DiscoverImportConfirmModal } from '../../ImportConfirmationModal'
import type { DiscoverActionContext } from '../context'
import type { ActionResult } from '../types'
import { findItemById } from '../utils'

type DownloadTarget = {
  id: string
  item: DiscoverItem | DiscoverItemDetail | null
  summary: DiscoverImportItemSummary
}

const presentImportConfirmation = (
  context: DiscoverActionContext,
  mode: 'selected' | 'preview',
  providerId: DiscoverProviderId,
  targets: DownloadTarget[],
) => {
  const i18n = getI18n()

  const handleConfirm = async (
    formData: TorrentFormData,
  ): Promise<ActionResult> => {
    context.setState((draft) => {
      draft.importing = true
    })

    try {
      const links = await Promise.all(
        targets.map((target) =>
          DiscoverService.downloadUrl(providerId, {
            id: target.id,
            item: target.item ?? undefined,
          }),
        ),
      )

      const uniqueUrls = Array.from(
        new Set(links.map((link) => link.url)),
      ).join('\n')

      if (!uniqueUrls) {
        throw new Error('missingDownloadUrls')
      }

      const options = createAddTorrentOptions(formData, {
        urls: uniqueUrls,
      })

      await TorrentActions.shared.addTorrent(options)

      context.setState((draft) => {
        draft.importing = false
        if (mode === 'selected') {
          draft.selectedIds = new Set()
        }
      })

      if (mode === 'selected') {
        toast.success(
          i18n.t('discover.messages.importSuccess', {
            count: targets.length,
          }),
        )
      } else {
        toast.success(i18n.t('discover.messages.singleImportSuccess'))
      }

      return { ok: true }
    } catch (error) {
      console.error(error)
      context.setState((draft) => {
        draft.importing = false
      })

      if (mode === 'selected') {
        toast.error(i18n.t('discover.messages.importFailed'))
      } else {
        toast.error(i18n.t('discover.messages.singleImportFailed'))
      }

      return { ok: false, error: 'requestFailed' }
    }
  }

  Modal.present(DiscoverImportConfirmModal, {
    mode,
    items: targets.map((target) => target.summary),
    onConfirm: handleConfirm,
  })
}

export const createImportingSlice = (context: DiscoverActionContext) => {
  const importSelected = async (): Promise<ActionResult> => {
    const state = context.getState()
    if (!state.providerReady) {
      return { ok: false, error: 'providerNotReady' }
    }
    if (state.selectedIds.size === 0) {
      return { ok: false, error: 'selectionEmpty' }
    }

    const targets: DownloadTarget[] = Array.from(state.selectedIds).map(
      (id) => {
        const item = findItemById(state.items, id) ?? null
        const summary: DiscoverImportItemSummary = {
          id,
          title: item?.title ?? id,
          category: item?.category ?? null,
        }

        return { id, item, summary }
      },
    )

    presentImportConfirmation(
      context,
      'selected',
      state.activeProviderId,
      targets,
    )

    return { ok: true }
  }

  const importPreview = async (): Promise<ActionResult> => {
    const state = context.getState()

    if (!state.providerReady) {
      return { ok: false, error: 'providerNotReady' }
    }

    const { previewId } = state
    if (!previewId) {
      return { ok: false, error: 'noPreview' }
    }

    const previewItem =
      state.previewDetail ?? findItemById(state.items, previewId) ?? null

    const targets: DownloadTarget[] = [
      {
        id: previewId,
        item: previewItem,
        summary: {
          id: previewId,
          title: previewItem?.title ?? previewId,
          category: previewItem?.category ?? null,
        },
      },
    ]

    presentImportConfirmation(
      context,
      'preview',
      state.activeProviderId,
      targets,
    )

    return { ok: true }
  }

  return {
    importSelected,
    importPreview,
  }
}
