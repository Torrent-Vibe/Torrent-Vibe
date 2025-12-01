import { formatBytes, formatEta, formatSpeedWithStatus } from '~/lib/format'

import type { MobileCellField } from '../types'

// Extended mobile field definitions with categories and better organization
export const ALL_MOBILE_FIELDS: MobileCellField[] = [
  // Primary Information - Core fields that define the torrent
  {
    id: 'name',
    label: 'Name',
    key: 'name',
    visible: true,
    primary: true,
    category: 'primary',
    icon: 'i-mingcute-file-line',
    description: 'Torrent name (always visible)',
  },
  {
    id: 'size',
    label: 'Size',
    key: 'size',
    visible: true,
    trailing: true,
    category: 'primary',
    icon: 'i-mingcute-hard-drive-line',
    description: 'Total file size',
    formatter: (value) => formatBytes(value),
  },
  {
    id: 'progress',
    label: 'Progress',
    key: 'progress',
    visible: true,
    trailing: true,
    category: 'primary',
    icon: 'i-mingcute-loading-line',
    description: 'Download progress percentage',
    formatter: (value) => `${(value * 100).toFixed(1)}%`,
  },
  {
    id: 'status',
    label: 'Status',
    key: 'state',
    visible: true,
    secondary: true,
    category: 'primary',
    icon: 'i-mingcute-information-line',
    description: 'Current torrent status',
  },

  // Details - Additional torrent information
  {
    id: 'category',
    label: 'Category',
    key: 'category',
    visible: true,
    secondary: true,
    category: 'details',
    icon: 'i-mingcute-folder-line',
    description: 'Torrent category',
  },
  {
    id: 'tags',
    label: 'Tags',
    key: 'tags',
    visible: false,
    secondary: true,
    category: 'details',
    icon: 'i-mingcute-tag-line',
    description: 'Torrent tags',
  },
  {
    id: 'priority',
    label: 'Priority',
    key: 'priority',
    visible: false,
    trailing: true,
    category: 'details',
    icon: 'i-mingcute-star-line',
    description: 'Download priority',
    formatter: (value) => {
      const priorities = {
        0: 'Normal',
        1: 'High',
        6: 'Very High',
        7: 'Maximum',
      }
      return priorities[value as keyof typeof priorities] || 'Normal'
    },
  },
  {
    id: 'tracker',
    label: 'Tracker',
    key: 'tracker',
    visible: false,
    secondary: true,
    category: 'details',
    icon: 'i-mingcute-earth-line',
    description: 'Primary tracker URL',
  },

  // Speeds & Progress - Performance metrics
  {
    id: 'dlspeed',
    label: 'Download Speed',
    key: 'dlspeed',
    visible: true,
    secondary: true,
    category: 'speeds',
    icon: 'i-mingcute-download-line',
    description: 'Current download speed',
    formatter: (value) => formatSpeedWithStatus(value).text,
  },
  {
    id: 'upspeed',
    label: 'Upload Speed',
    key: 'upspeed',
    visible: true,
    secondary: true,
    category: 'speeds',
    icon: 'i-mingcute-upload-line',
    description: 'Current upload speed',
    formatter: (value) => formatSpeedWithStatus(value).text,
  },
  {
    id: 'eta',
    label: 'ETA',
    key: 'eta',
    visible: false,
    trailing: true,
    category: 'speeds',
    icon: 'i-mingcute-time-line',
    description: 'Estimated time remaining',
    formatter: (value) => formatEta(value),
  },
  {
    id: 'ratio',
    label: 'Ratio',
    key: 'ratio',
    visible: false,
    trailing: true,
    category: 'speeds',
    icon: 'i-mingcute-exchange-line',
    description: 'Share ratio (uploaded/downloaded)',
    formatter: (value) => value?.toFixed(2) || '0.00',
  },

  // Seeds & Peers - Connection information
  {
    id: 'num_seeds',
    label: 'Seeds',
    key: 'seeds',
    visible: false,
    trailing: true,
    category: 'speeds',
    icon: 'i-mingcute-plant-line',
    description: 'Number of seeds',
    formatter: (value) => value?.toString() || '0',
  },
  {
    id: 'num_leechs',
    label: 'Peers',
    key: 'peers',
    visible: false,
    trailing: true,
    category: 'speeds',
    icon: 'i-mingcute-group-line',
    description: 'Number of peers',
    formatter: (value) => value?.toString() || '0',
  },

  // Dates & Time - Temporal information
  {
    id: 'added_on',
    label: 'Added On',
    key: 'addedOn',
    visible: false,
    secondary: true,
    category: 'dates',
    icon: 'i-mingcute-calendar-add-line',
    description: 'When torrent was added',
    formatter: (value) => (value ? formatDate(value) : 'Unknown'),
  },
  {
    id: 'completion_on',
    label: 'Completed On',
    key: 'completedOn',
    visible: false,
    secondary: true,
    category: 'dates',
    icon: 'i-mingcute-calendar-check-line',
    description: 'When torrent completed',
    formatter: (value) => (value ? formatDate(value) : 'Not completed'),
  },
  {
    id: 'time_active',
    label: 'Active Time',
    key: 'custom',
    visible: false,
    trailing: true,
    category: 'dates',
    icon: 'i-mingcute-stopwatch-line',
    description: 'Total active time',
    formatter: (_, torrent) => formatDuration(torrent.timeActive || 0),
  },

  // Advanced - Technical details
  {
    id: 'downloaded',
    label: 'Downloaded',
    key: 'completed',
    visible: false,
    trailing: true,
    category: 'advanced',
    icon: 'i-mingcute-download-2-line',
    description: 'Amount downloaded',
    formatter: (value) => formatBytes(value),
  },
  {
    id: 'uploaded',
    label: 'Uploaded',
    key: 'custom',
    visible: false,
    trailing: true,
    category: 'advanced',
    icon: 'i-mingcute-upload-2-line',
    description: 'Amount uploaded',
    formatter: (_, torrent) => formatBytes(torrent.uploaded || 0),
  },
  {
    id: 'amount_left',
    label: 'Remaining',
    key: 'custom',
    visible: false,
    trailing: true,
    category: 'advanced',
    icon: 'i-mingcute-hourglass-line',
    description: 'Amount remaining to download',
    formatter: (_, torrent) =>
      formatBytes((torrent.size || 0) - (torrent.completed || 0)),
  },
  {
    id: 'save_path',
    label: 'Save Path',
    key: 'custom',
    visible: false,
    secondary: true,
    category: 'advanced',
    icon: 'i-mingcute-folder-open-line',
    description: 'Download location',
    formatter: (_, torrent) => torrent.savePath || 'Unknown',
  },
]

// Default visible fields - matches current MobileTorrentCard structure
export const DEFAULT_MOBILE_FIELDS: MobileCellField[] = ALL_MOBILE_FIELDS.map(
  (field) => ({
    ...field,
    visible: [
      'name',
      'status',
      'size',
      'progress',
      'dlspeed',
      'upspeed',
      'category',
    ].includes(field.id),
  }),
)

// Field groups for UI organization
export const MOBILE_FIELD_GROUPS = {
  primary: 'Primary Information',
  details: 'Details',
  speeds: 'Speed & Progress',
  dates: 'Dates & Time',
  advanced: 'Advanced',
} as const

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return 'Today'
  } else if (days === 1) {
    return 'Yesterday'
  } else if (days < 7) {
    return `${days} days ago`
  } else {
    return date.toLocaleDateString()
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  return `${minutes}m`
}
