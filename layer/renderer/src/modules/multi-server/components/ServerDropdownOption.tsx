import * as React from 'react'

import { useServerHealthStore } from '../stores/server-health-store'
import { healthToTitle, healthToVariant } from '../utils/health-ui'
import { ServerIconWithStatus } from './ServerIconWithStatus'

interface ServerDropdownOptionProps {
  serverId: string
  serverName: string
  hostLabel?: string
}

export const ServerDropdownOption: React.FC<ServerDropdownOptionProps> = ({
  serverId,
  serverName,
  hostLabel,
}) => {
  const serverHealth = useServerHealthStore((s) => s.results[serverId])

  const variant = healthToVariant(serverHealth)
  const title = healthToTitle(serverHealth)

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <ServerIconWithStatus variant={variant} size="sm" title={title} />
        <span className="text-sm">{serverName}</span>
      </div>
      {hostLabel && (
        <span className="text-xs text-text-secondary opacity-60 ml-2 truncate">
          {hostLabel}
        </span>
      )}
    </div>
  )
}
