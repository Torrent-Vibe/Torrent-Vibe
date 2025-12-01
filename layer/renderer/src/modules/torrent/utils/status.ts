import type { TorrentState } from '~/types/torrent'

export interface StatusConfig {
  label: I18nKeys
  className: string
}

export const getStatusConfig = (state: TorrentState): StatusConfig => {
  switch (state) {
    case 'error': {
      return {
        label: 'torrent.status.error',
        className: 'bg-red/10 text-red border-red/30',
      }
    }
    case 'pausedUP': {
      return {
        label: 'torrent.status.done',
        className: 'bg-green/10 text-green border-green/30',
      }
    }
    case 'pausedDL': {
      return {
        label: 'torrent.status.paused',
        className: 'bg-orange/10 text-orange border-orange/30',
      }
    }
    case 'queuedUP': {
      return {
        label: 'torrent.status.queuedSeed',
        className: 'bg-yellow/10 text-yellow border-yellow/30',
      }
    }
    case 'queuedDL': {
      return {
        label: 'torrent.status.queuedDL',
        className: 'bg-yellow/10 text-yellow border-yellow/30',
      }
    }
    case 'uploading': {
      return {
        label: 'torrent.status.seeding',
        className: 'bg-green/10 text-green border-green/30',
      }
    }
    case 'stalledUP': {
      return {
        label: 'torrent.status.stalledSeed',
        className: 'bg-orange/10 text-orange border-orange/30',
      }
    }
    case 'checkingUP': {
      return {
        label: 'torrent.status.checkingSeed',
        className: 'bg-purple/10 text-purple border-purple/30',
      }
    }
    case 'checkingDL': {
      return {
        label: 'torrent.status.checkingDL',
        className: 'bg-purple/10 text-purple border-purple/30',
      }
    }
    case 'downloading': {
      return {
        label: 'torrent.status.downloading',
        className: 'bg-blue/10 text-blue border-blue/30',
      }
    }
    case 'stoppedDL': {
      return {
        label: 'torrent.status.stoppedDL',
        className: 'bg-gray/10 text-gray border-gray/30',
      }
    }
    case 'stoppedUP': {
      return {
        label: 'torrent.status.done',
        className: 'bg-green/10 text-green border-green/30',
      }
    }
    case 'stalledDL': {
      return {
        label: 'torrent.status.stalledDL',
        className: 'bg-orange/10 text-orange border-orange/30',
      }
    }
    case 'forcedDL': {
      return {
        label: 'torrent.status.forcedDL',
        className: 'bg-blue/10 text-blue border-blue/30',
      }
    }
    case 'ForcedMetaDL': {
      return {
        label: 'torrent.status.forcedMetaDL',
        className: 'bg-blue/10 text-blue border-blue/30',
      }
    }
    case 'forcedUP': {
      return {
        label: 'torrent.status.forcedSeed',
        className: 'bg-green/10 text-green border-green/30',
      }
    }
    case 'metaDL': {
      return {
        label: 'torrent.status.metaDL',
        className: 'bg-blue/10 text-blue border-blue/30',
      }
    }
    case 'allocating': {
      return {
        label: 'torrent.status.allocating',
        className: 'bg-gray/10 text-gray border-gray/30',
      }
    }
    case 'queuedForChecking': {
      return {
        label: 'torrent.status.queuedCheck',
        className: 'bg-purple/10 text-purple border-purple/30',
      }
    }
    case 'checkingResumeData': {
      return {
        label: 'torrent.status.resumeCheck',
        className: 'bg-purple/10 text-purple border-purple/30',
      }
    }
    case 'missingFiles': {
      return {
        label: 'torrent.status.missing',
        className: 'bg-red/10 text-red border-red/30',
      }
    }
    case 'moving': {
      return {
        label: 'torrent.status.moving',
        className: 'bg-gray/10 text-gray border-gray/30',
      }
    }

    default: {
      return {
        label: 'torrent.status.unknown',
        className: 'bg-gray/10 text-gray border-gray/30',
      }
    }
  }
}

export const getStatusColor = (state: TorrentState | string): string => {
  const config = getStatusConfig(state as TorrentState)
  // Extract text color from className (e.g., 'bg-red/10 text-red border-red/30' -> 'text-red')
  const textColorMatch = config.className.match(/text-(\w+)/)
  return textColorMatch ? `text-${textColorMatch[1]}` : 'text-text-secondary'
}
