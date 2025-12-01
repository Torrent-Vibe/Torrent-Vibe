import { atomWithStorage } from 'jotai/utils'

import { createAtomHooks } from '~/lib/jotai'
import type {
  InputMethod,
  TorrentFormData,
} from '~/modules/modals/AddTorrentModal/types'

// Define the persistable form data (excluding files and magnetLinks)
export interface PersistableTorrentFormData {
  method: InputMethod
  // Basic settings
  savepath?: string
  category?: string
  tags?: string
  rename?: string
  cookie?: string

  // Boolean options (stored as optional booleans)
  skip_checking?: boolean
  root_folder?: boolean
  autoTMM?: boolean
  sequentialDownload?: boolean
  firstLastPiecePrio?: boolean

  // Numeric limits (stored as optional numbers)
  ratioLimit?: number
  seedingTimeLimit?: number

  // UI helper fields (always persisted)
  startTorrent: boolean
  limitDownloadKiBs: string
  limitUploadKiBs: string
}

// Default values for persistent form data
export const defaultPersistentFormData: PersistableTorrentFormData = {
  method: 'magnet',
  startTorrent: true,
  limitDownloadKiBs: '',
  limitUploadKiBs: '',
}

// Create persistent atom with localStorage
const addTorrentFormPersistentAtom = atomWithStorage(
  'torrent-vibe:add-torrent-form-settings',
  defaultPersistentFormData,
)

// Export hooks for the persistent form data
export const [
  addTorrentFormPersistentAtomInstance,
  useAddTorrentFormPersistent,
  useAddTorrentFormPersistentValue,
  useSetAddTorrentFormPersistent,
  getAddTorrentFormPersistent,
  setAddTorrentFormPersistent,
] = createAtomHooks(addTorrentFormPersistentAtom)

// Helper functions to convert between full form data and persistent data
export const extractPersistentData = (
  formData: TorrentFormData,
): PersistableTorrentFormData => ({
  method: formData.method,
  savepath: formData.savepath,
  category: formData.category,
  tags: formData.tags,
  rename: formData.rename,
  cookie: formData.cookie,
  skip_checking: formData.skip_checking,
  root_folder: formData.root_folder,
  autoTMM: formData.autoTMM,
  sequentialDownload: formData.sequentialDownload,
  firstLastPiecePrio: formData.firstLastPiecePrio,
  ratioLimit: formData.ratioLimit,
  seedingTimeLimit: formData.seedingTimeLimit,
  startTorrent: formData.startTorrent,
  limitDownloadKiBs: formData.limitDownloadKiBs,
  limitUploadKiBs: formData.limitUploadKiBs,
})

const defaultBaseFormData: TorrentFormData = {
  ...defaultPersistentFormData,
  magnetLinks: '',
  files: [],
}

export const mergePersistentData = (
  persistentData: PersistableTorrentFormData,
  baseFormData: TorrentFormData = defaultBaseFormData,
): TorrentFormData => ({
  ...baseFormData,
  ...persistentData,
})
