// Mobile Cell Field Types
// Helper functions
import { formatBytes, formatEta, formatSpeedWithStatus } from '~/lib/format'

export interface MobileCellField {
  id: string
  label: string
  key: keyof TorrentData | 'custom'
  visible: boolean
  primary?: boolean // For main title
  secondary?: boolean // For subtitle
  trailing?: boolean // For right side info
  formatter?: (value: any, torrent: TorrentData) => string
  icon?: string
  category?: 'primary' | 'details' | 'speeds' | 'dates' | 'advanced'
  description?: string
}

export interface TorrentData {
  hash: string
  name: string
  size: number
  completed: number
  progress: number
  state: string
  category: string
  tags: string
  dlspeed: number
  upspeed: number
  eta: number
  ratio: number
  priority: number
  addedOn: number
  completedOn: number
  seeds: number
  peers: number
  uploaded?: number
  timeActive?: number
  tracker?: string
  savePath?: string
}

export interface MobileCellConfig {
  fields: MobileCellField[]
  layout: 'compact' | 'detailed'
  showProgress: boolean
  showSeparator: boolean
}

// Default field configurations
export const DEFAULT_MOBILE_FIELDS: MobileCellField[] = [
  {
    id: 'name',
    label: 'Name',
    key: 'name',
    visible: true,
    primary: true,
  },
  {
    id: 'status',
    label: 'Status',
    key: 'state',
    visible: true,
    secondary: true,
  },
  {
    id: 'size',
    label: 'Size',
    key: 'size',
    visible: true,
    trailing: true,
    formatter: (value) => formatBytes(value),
  },
  {
    id: 'progress',
    label: 'Progress',
    key: 'progress',
    visible: true,
    trailing: true,
    formatter: (value) => `${(value * 100).toFixed(1)}%`,
  },
  {
    id: 'speed',
    label: 'Speed',
    key: 'custom',
    visible: true,
    secondary: true,
    formatter: (_, torrent) =>
      `↓ ${formatSpeedWithStatus(torrent.dlspeed).text} ↑ ${formatSpeedWithStatus(torrent.upspeed).text}`,
  },
  {
    id: 'eta',
    label: 'ETA',
    key: 'eta',
    visible: false,
    trailing: true,
    formatter: (value) => formatEta(value),
  },
  {
    id: 'ratio',
    label: 'Ratio',
    key: 'ratio',
    visible: false,
    trailing: true,
    formatter: (value) => value?.toFixed(2) || '0.00',
  },
]
