import type { AddTorrentOptions } from '@torrent-vibe/qb-client'

import type { TorrentFormData } from '../types'

const cleanUndefined = <T extends Record<string, unknown>>(value: T) => {
  const entries = Object.entries(value).filter(
    ([, v]) => v !== undefined && v !== '',
  )
  return Object.fromEntries(entries) as T
}

export const createAddTorrentOptions = (
  formData: TorrentFormData,
  overrides: Partial<AddTorrentOptions> = {},
): AddTorrentOptions => {
  const hasMagnets =
    formData.magnetLinks.trim() !== '' &&
    formData.magnetLinks.includes('magnet:')
  const hasFiles = formData.files.length > 0

  const baseOptions: AddTorrentOptions = {
    urls: hasMagnets ? formData.magnetLinks : undefined,
    torrents: hasFiles ? formData.files : undefined,
    savepath: formData.savepath,
    category:
      formData.category && formData.category !== 'none'
        ? formData.category
        : undefined,
    tags: formData.tags,
    rename: formData.rename,
    cookie: formData.cookie,
    skip_checking: formData.skip_checking,
    stopped: !formData.startTorrent,
    root_folder: formData.root_folder,
    autoTMM: formData.autoTMM,
    sequentialDownload: formData.sequentialDownload,
    firstLastPiecePrio: formData.firstLastPiecePrio,
    upLimit:
      formData.limitUploadKiBs !== ''
        ? Number(formData.limitUploadKiBs) * 1024
        : formData.upLimit,
    dlLimit:
      formData.limitDownloadKiBs !== ''
        ? Number(formData.limitDownloadKiBs) * 1024
        : formData.dlLimit,
    ratioLimit: formData.ratioLimit,
    seedingTimeLimit: formData.seedingTimeLimit,
  }

  return cleanUndefined({
    ...baseOptions,
    ...overrides,
  })
}
