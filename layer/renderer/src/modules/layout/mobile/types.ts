// Mobile Cell Field Types
// Helper functions
import { formatBytes, formatEta, formatSpeedWithStatus } from '~/lib/format'

export interface MobileCellField {
  category?: 'primary' | 'details' | 'speeds' | 'dates' | 'advanced'
  description?: string
  formatter?: (value: any, torrent: TorrentData) => string
  icon?: string
  id: string
  key: keyof TorrentData | 'custom'
  label: string
  primary?: boolean // For main title
  secondary?: boolean // For subtitle
  trailing?: boolean // For right side info
  visible: boolean
}

export interface TorrentData {
  addedOn: number
  category: string
  completed: number
  completedOn: number
  dlspeed: number
  eta: number
  hash: string
  name: string
  peers: number
  priority: number
  progress: number
  ratio: number
  savePath?: string
  seeds: number
  size: number
  state: string
  tags: string
  timeActive?: number
  tracker?: string
  uploaded?: number
  upspeed: number
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
