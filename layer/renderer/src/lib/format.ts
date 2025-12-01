export function formatBytes(
  bytes: number | undefined,
  fractionDigits = 1,
): string {
  const value = typeof bytes === 'number' ? bytes : 0
  if (value === 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(value) / Math.log(k))
  const size = (value / Math.pow(k, i)).toFixed(fractionDigits)
  return `${size} ${units[i]}`
}

export function formatEta(etaSeconds: number | undefined): string {
  const eta = typeof etaSeconds === 'number' ? etaSeconds : -1
  if (eta < 0 || eta === 8640000) return 'Unknown'
  if (eta === 0) return 'Done'
  const years = Math.floor(eta / 31536000)
  const months = Math.floor((eta % 31536000) / 2592000)
  const days = Math.floor(eta / 86400)
  const hours = Math.floor((eta % 86400) / 3600)
  const minutes = Math.floor((eta % 3600) / 60)
  if (years > 0) {
    return `${years}y ${months}m`
  }
  if (months > 0) {
    return `${months}mo ${days}d`
  }
  if (days > 0) {
    return `${days}d ${hours}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

export function formatDateTime(timestampSeconds: number | undefined): string {
  if (!timestampSeconds || timestampSeconds <= 0) return '—'
  const date = new Date(timestampSeconds * 1000)
  return date.toLocaleString()
}

// Matches table cells style: 0 decimals when number is large (>=100), else 1
export function formatBytesSmart(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  const precision = size >= 100 ? 0 : 1
  return `${size.toFixed(precision)} ${units[unitIndex]}`
}

/**
 * Formats bytes per second to human-readable speed string
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s'

  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s']
  let size = bytesPerSecond
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  // Show more precision for smaller values - consistent with formatBytesSmart
  const precision = size >= 100 ? 0 : size >= 10 ? 1 : 2
  return `${size.toFixed(precision)} ${units[unitIndex]}`
}

/**
 * Speed color classification levels for UI styling
 */
export interface SpeedColorConfig {
  text: string
  colorClass: string
}

/**
 * Formats speed with color coding based on activity level
 */
export function formatSpeedWithStatus(
  bytesPerSecond: number,
): SpeedColorConfig {
  const text = formatSpeed(bytesPerSecond)

  // Color coding based on speed
  let colorClass = 'text-text-secondary'
  if (bytesPerSecond > 0) {
    if (bytesPerSecond > 10 * 1024 * 1024) {
      // > 10 MB/s
      colorClass = 'text-green font-medium'
    } else if (bytesPerSecond > 1024 * 1024) {
      // > 1 MB/s
      colorClass = 'text-blue font-medium'
    } else if (bytesPerSecond > 0) {
      // > 0 B/s
      colorClass = 'text-accent font-medium'
    }
  }

  return { text, colorClass }
}
