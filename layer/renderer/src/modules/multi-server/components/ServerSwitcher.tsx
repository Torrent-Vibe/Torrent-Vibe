import { useEffect, useMemo } from 'react'

import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu/DropdownMenu'

import { useServerSwitching } from '../hooks/useServerSwitching'
import {
  multiServerStoreSetters,
  useMultiServerStore,
} from '../stores/multi-server-store'
import { useServerHealthStore } from '../stores/server-health-store'
import { healthToTitle, healthToVariant } from '../utils/health-ui'
import {
  loadMultiServerConfig,
  migrateToMultiServer,
  saveMultiServerConfig,
} from '../utils/server-config'
import { ServerDropdownOption } from './ServerDropdownOption'
import { ServerIconWithStatus } from './ServerIconWithStatus'

interface ServerSwitcherProps {
  className?: string
}

export const ServerSwitcher = ({ className }: ServerSwitcherProps) => {
  // Initialize from storage on first mount
  useEffect(() => {
    if (!ELECTRON) return
    // Load existing or migrate legacy
    const ms = loadMultiServerConfig()

    const cfg = ms.servers.length > 0 ? ms : migrateToMultiServer()
    multiServerStoreSetters.replaceAll(cfg)
  }, [])

  const { switchTo } = useServerSwitching()

  const { order, servers, activeServerId } = useMultiServerStore((s) => ({
    order: s.order,
    servers: s.servers,
    activeServerId: s.activeServerId,
  }))

  // persist on change (lightweight debounce not necessary for minimal v1)
  useEffect(() => {
    if (!ELECTRON) return
    const data = {
      servers: order.map((id) => servers[id]).filter(Boolean),
      activeServerId,
    }
    saveMultiServerConfig(data)
  }, [order, servers, activeServerId])

  const activeName = useMemo(() => {
    if (!activeServerId) return 'No Server'
    return servers[activeServerId]?.name ?? 'Unknown'
  }, [activeServerId, servers])

  const health = useServerHealthStore((s) =>
    activeServerId ? s.results[activeServerId] : undefined,
  )

  if (!ELECTRON) return null

  // Helper functions are now encapsulated in composable components

  // For 2 servers: simple toggle behavior
  const handleToggle = async () => {
    if (order.length !== 2) return
    const idx = activeServerId ? order.indexOf(activeServerId) : -1
    const nextId = order[(idx + 1) % order.length]
    if (nextId && nextId !== activeServerId) await switchTo(nextId)
  }

  // For 3+ servers: use dropdown menu
  if (order.length >= 3) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="md"
            className={className}
            title="Switch server"
          >
            <ServerIconWithStatus
              variant={healthToVariant(health)}
              size="md"
              title={healthToTitle(health)}
              className="mr-2"
            />
            <span className="text-xs">{activeName}</span>
            <i className="i-mingcute-down-line ml-1 text-xs opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuRadioGroup
            value={activeServerId || ''}
            onValueChange={switchTo}
          >
            {order.map((serverId) => {
              const server = servers[serverId]
              if (!server) return null

              return (
                <DropdownMenuRadioItem key={serverId} value={serverId}>
                  <ServerDropdownOption
                    serverId={serverId}
                    serverName={server.name}
                    hostLabel={
                      server.config
                        ? server.config.baseUrl
                          ? new URL(server.config.baseUrl).hostname
                          : `${server.config.host}:${server.config.port}`
                        : undefined
                    }
                  />
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // For 1 server: display only, no interaction
  if (order.length <= 1) {
    return null
  }

  // For exactly 2 servers: simple toggle behavior
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      onClick={handleToggle}
      title="Click to switch between servers"
    >
      <ServerIconWithStatus
        variant={healthToVariant(health)}
        size="md"
        title={healthToTitle(health)}
        className="mr-2"
      />
      <span className="text-xs">{activeName}</span>
      <i className="i-mingcute-repeat-line ml-1 text-xs opacity-60" />
    </Button>
  )
}
