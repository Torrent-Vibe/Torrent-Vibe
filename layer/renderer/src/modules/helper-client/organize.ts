import { toast } from 'sonner'

import { getI18n } from '~/i18n'
import { ipcServices } from '~/lib/ipc-client'
import type { TorrentInfo } from '~/types/torrent'

import { postHelperOrganize } from './api'
import { getHelperBinding, resolveCurrentServerId } from './bindings'
import type { HelperOrganizeResult } from './types'

const COMPLETE_STATES = new Set([
  'uploading',
  'pausedUP',
  'stoppedUP',
  'stalledUP',
  'queuedUP',
  'forcedUP',
  'checkingUP',
])

export const isCompletedTorrent = (torrent: TorrentInfo): boolean =>
  torrent.progress >= 1 || COMPLETE_STATES.has(torrent.state)

export const isHelperManagedTorrent = (torrent: TorrentInfo): boolean =>
  (torrent.tags || '').includes('tv-mikan:')

export const canOrganizeTorrent = (torrent: TorrentInfo): boolean => {
  const serverId = resolveCurrentServerId()
  return (
    Boolean(serverId && getHelperBinding(serverId)) &&
    isCompletedTorrent(torrent) &&
    !isHelperManagedTorrent(torrent)
  )
}

const reasonMessage = (result: HelperOrganizeResult): string => {
  const { t } = getI18n()
  if (result.reason) {
    const key = `torrent.organize.reason.${result.reason}`
    const translated = t(key)
    if (translated !== key) {
      return translated
    }
    return result.reason
  }
  return t('torrent.organize.needsManual')
}

export const organizeHelperTorrent = async (hash: string): Promise<void> => {
  const { t } = getI18n()
  const serverId = resolveCurrentServerId()
  const binding = serverId ? getHelperBinding(serverId) : null
  if (!binding) {
    toast.error(t('torrent.organize.noHelper'))
    return
  }
  try {
    const result = await postHelperOrganize(binding.url, binding.token, hash)
    if (result.status === 'ok' || result.status === 'already') {
      const dest = result.dest || result.libraryRelPath || ''
      toast.success(
        dest
          ? t('torrent.organize.ok', { dest })
          : t('torrent.organize.already'),
      )
      if (
        typeof ELECTRON !== 'undefined' &&
        ELECTRON &&
        result.dest &&
        ipcServices?.fileSystem
      ) {
        void ipcServices.fileSystem.handlePathAction({
          action: 'reveal',
          candidates: [result.dest],
        })
      }
      return
    }
    if (result.status === 'skipped') {
      toast.info(t('torrent.organize.skipped'))
      return
    }
    toast.error(reasonMessage(result))
  } catch {
    toast.error(t('torrent.organize.failed'))
  }
}
