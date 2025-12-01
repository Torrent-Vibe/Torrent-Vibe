import type { TorrentState } from '../../../types/torrent'

export interface TorrentStateIconProps {
  state: TorrentState
  progress?: number
  className?: string
}

interface StateIconConfig {
  icon: string
  color: string
}

const stateIconMap: Record<TorrentState, StateIconConfig> = {
  // Error states
  error: {
    icon: 'i-lucide-x-circle',
    color: 'text-red-500',
  },
  missingFiles: {
    icon: 'i-lucide-alert-triangle',
    color: 'text-red-500',
  },

  // Download states
  downloading: {
    icon: 'i-lucide-download',
    color: 'text-blue-500',
  },
  metaDL: {
    icon: 'i-lucide-download',
    color: 'text-blue-400',
  },
  forcedDL: {
    icon: 'i-lucide-download-cloud',
    color: 'text-blue-600',
  },
  ForcedMetaDL: {
    icon: 'i-lucide-download-cloud',
    color: 'text-blue-600',
  },
  stalledDL: {
    icon: 'i-lucide-pause-circle',
    color: 'text-orange-500',
  },
  queuedDL: {
    icon: 'i-lucide-clock',
    color: 'text-yellow-500',
  },
  pausedDL: {
    icon: 'i-lucide-pause',
    color: 'text-orange-500',
  },
  stoppedDL: {
    icon: 'i-lucide-stop-circle',
    color: 'text-gray-500',
  },

  // Upload/Seeding states
  uploading: {
    icon: 'i-lucide-upload',
    color: 'text-green-500',
  },
  pausedUP: {
    icon: 'i-lucide-check-circle',
    color: 'text-green-500',
  },
  stalledUP: {
    icon: 'i-lucide-pause-circle',
    color: 'text-orange-500',
  },
  queuedUP: {
    icon: 'i-lucide-clock',
    color: 'text-yellow-500',
  },
  forcedUP: {
    icon: 'i-lucide-upload-cloud',
    color: 'text-green-600',
  },
  stoppedUP: {
    icon: 'i-lucide-check-circle',
    color: 'text-green-500',
  },

  // Checking states
  checkingUP: {
    icon: 'i-lucide-loader-2',
    color: 'text-purple-500',
  },
  checkingDL: {
    icon: 'i-lucide-loader-2',
    color: 'text-purple-500',
  },
  checkingResumeData: {
    icon: 'i-lucide-loader-2',
    color: 'text-purple-400',
  },
  queuedForChecking: {
    icon: 'i-lucide-clock',
    color: 'text-purple-400',
  },

  // Other states
  allocating: {
    icon: 'i-lucide-hard-drive',
    color: 'text-blue-400',
  },
  moving: {
    icon: 'i-lucide-move',
    color: 'text-blue-400',
  },
  unknown: {
    icon: 'i-lucide-help-circle',
    color: 'text-gray-500',
  },
}

export const TorrentStateIcon = ({
  state,
  progress,
  className = 'text-lg',
}: TorrentStateIconProps) => {
  // Special case: if progress is 1 (100%) and state is uploading/pausedUP, show completed icon
  if (progress === 1 && (state === 'uploading' || state === 'pausedUP')) {
    return (
      <i
        className={`i-lucide-check-circle text-green-500 ${className}`}
        title="Completed"
      />
    )
  }

  const config = stateIconMap[state]

  // Add animation for loading states
  const isLoading = ['checkingUP', 'checkingDL', 'checkingResumeData'].includes(
    state,
  )
  const animationClass = isLoading ? 'animate-spin' : ''

  return (
    <i
      className={`${config.icon} ${config.color} ${animationClass} ${className}`}
      title={state}
    />
  )
}
