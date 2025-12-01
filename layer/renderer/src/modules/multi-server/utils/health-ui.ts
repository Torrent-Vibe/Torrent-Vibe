import type { StatusVariant } from '~/components/ui/status-dot'

import type { ServerHealthResult } from '../types/multi-server'

export const healthToVariant = (health?: ServerHealthResult): StatusVariant => {
  if (health?.status === 'healthy') return 'success'
  if (health?.status === 'warning') return 'warning'
  if (health?.status === 'unhealthy') return 'danger'
  return 'unknown'
}

export const healthToTitle = (health?: ServerHealthResult): string =>
  health
    ? `${health.status} · ${health.responseTime}ms${health.version ? ` · v${health.version}` : ''}`
    : 'unknown'
