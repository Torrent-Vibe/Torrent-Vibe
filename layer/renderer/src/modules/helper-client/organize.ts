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

const REASON_KEYS = {
  collection: 'torrent.organize.reason.collection',
  'dest-conflict': 'torrent.organize.reason.dest-conflict',
  'missing-episode': 'torrent.organize.reason.missing-episode',
  'missing-library-root': 'torrent.organize.reason.missing-library-root',
  'missing-save-path': 'torrent.organize.reason.missing-save-path',
  'missing-tmdb-key': 'torrent.organize.reason.missing-tmdb-key',
  'no-unique-tmdb': 'torrent.organize.reason.no-unique-tmdb',
  'no-video': 'torrent.organize.reason.no-video',
  'parse-failed': 'torrent.organize.reason.parse-failed',
  'unsupported-kind': 'torrent.organize.reason.unsupported-kind',
} as const

const reasonMessage = (result: HelperOrganizeResult): string => {
  const { t } = getI18n()
  const key =
    result.reason && result.reason in REASON_KEYS
      ? REASON_KEYS[result.reason as keyof typeof REASON_KEYS]
      : null
  if (key) {
    return t(key)
  }
  return result.reason || t('torrent.organize.needsManual')
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
