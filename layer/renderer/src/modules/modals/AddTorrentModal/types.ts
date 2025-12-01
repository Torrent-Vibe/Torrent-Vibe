export type InputMethod = 'magnet' | 'file'

export interface TorrentFormData {
  method: InputMethod
  // Input sources
  magnetLinks: string // URLs separated with newlines (for magnet links and HTTP URLs)
  files: File[] // Raw torrent file data - can be provided multiple times

  // Basic settings
  savepath?: string // Download folder
  category?: string // Category for the torrent
  tags?: string // Tags for the torrent, split by ','
  rename?: string // Rename torrent
  cookie?: string // Cookie sent to download the .torrent file

  // Boolean options
  skip_checking?: boolean // Skip hash checking
  paused?: boolean // Add torrents in the paused state (opposite of startTorrent)
  root_folder?: boolean // Create the root folder
  autoTMM?: boolean // Whether Automatic Torrent Management should be used
  sequentialDownload?: boolean // Enable sequential download
  firstLastPiecePrio?: boolean // Prioritize download first last piece

  // Numeric limits
  upLimit?: number // Set torrent upload speed limit in bytes/second
  dlLimit?: number // Set torrent download speed limit in bytes/second
  ratioLimit?: number // Set torrent share ratio limit
  seedingTimeLimit?: number // Set torrent seeding time limit in minutes

  // UI helper fields (not sent to API)
  startTorrent: boolean // UI field - converted to paused
  limitDownloadKiBs: string // UI field - converted to dlLimit
  limitUploadKiBs: string // UI field - converted to upLimit
}

export interface TorrentContentPreviewFile {
  index: number
  path: string
  size: number
}

export interface TorrentContentPreviewState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  source?: InputMethod
  name?: string
  hash?: string
  totalSize?: number
  files: TorrentContentPreviewFile[]
  error?: string
  displayName?: string
}

export interface TorrentFormHandlers {
  setFormData: React.Dispatch<React.SetStateAction<TorrentFormData>>
  handleFilesSelected: (files: File[]) => Promise<void> | void
  removeFile: (index: number) => void
  loadMagnetPreview: () => Promise<void>
  refreshFilePreview: () => Promise<void>
  clearPreview: () => Promise<void>
  toggleFileSelection: (index: number, next?: boolean) => void
  toggleAllFileSelections: (select: boolean) => void
  previewState: TorrentContentPreviewState
  selectedFileIndices: Set<number>
  isPreviewLoading: boolean
}
