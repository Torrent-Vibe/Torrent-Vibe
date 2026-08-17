export type InputMethod = 'magnet' | 'file'

export interface TorrentFormData {
  autoTMM?: boolean // Whether Automatic Torrent Management should be used
  category?: string // Category for the torrent
  cookie?: string // Cookie sent to download the .torrent file

  dlLimit?: number // Set torrent download speed limit in bytes/second
  files: File[] // Raw torrent file data - can be provided multiple times
  firstLastPiecePrio?: boolean // Prioritize download first last piece
  limitDownloadKiBs: string // UI field - converted to dlLimit
  limitUploadKiBs: string // UI field - converted to upLimit

  // Input sources
  magnetLinks: string // URLs separated with newlines (for magnet links and HTTP URLs)
  method: InputMethod
  paused?: boolean // Add torrents in the paused state (opposite of startTorrent)
  ratioLimit?: number // Set torrent share ratio limit
  rename?: string // Rename torrent
  root_folder?: boolean // Create the root folder

  // Basic settings
  savepath?: string // Download folder
  seedingTimeLimit?: number // Set torrent seeding time limit in minutes
  sequentialDownload?: boolean // Enable sequential download
  // Boolean options
  skip_checking?: boolean // Skip hash checking

  // UI helper fields (not sent to API)
  startTorrent: boolean // UI field - converted to paused
  tags?: string // Tags for the torrent, split by ','
  // Numeric limits
  upLimit?: number // Set torrent upload speed limit in bytes/second
}

export interface TorrentContentPreviewFile {
  index: number
  path: string
  size: number
}

export interface TorrentContentPreviewState {
  displayName?: string
  error?: string
  files: TorrentContentPreviewFile[]
  hash?: string
  name?: string
  source?: InputMethod
  status: 'idle' | 'loading' | 'ready' | 'error'
  totalSize?: number
}

export interface TorrentFormHandlers {
  clearPreview: () => Promise<void>
  handleFilesSelected: (files: File[]) => Promise<void> | void
  isPreviewLoading: boolean
  loadMagnetPreview: () => Promise<void>
  previewState: TorrentContentPreviewState
  refreshFilePreview: () => Promise<void>
  removeFile: (index: number) => void
  selectedFileIndices: Set<number>
  setFormData: React.Dispatch<React.SetStateAction<TorrentFormData>>
  toggleAllFileSelections: (select: boolean) => void
  toggleFileSelection: (index: number, next?: boolean) => void
}
