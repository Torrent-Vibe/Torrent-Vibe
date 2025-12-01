import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { Prompt } from '~/components/ui/prompts'

import { useServerSwitching } from '../hooks/useServerSwitching'
import {
  multiServerStoreSetters,
  useMultiServerStore,
} from '../stores/multi-server-store'
import { useServerHealthStore } from '../stores/server-health-store'
import type { ServerConnection } from '../types/multi-server'
import { showEditServerModal } from '../utils/modal-helpers'
import {
  hasServerPassword,
  saveMultiServerConfig,
} from '../utils/server-config'

interface ServerItemProps {
  server: ServerConnection
  isActive: boolean
}

export const ServerItem = memo(({ server, isActive }: ServerItemProps) => {
  const { t } = useTranslation()
  const { switchTo } = useServerSwitching()

  const health = useServerHealthStore((s) => s.results[server.id])
  const remembered = hasServerPassword(server.id)

  const handleActivate = async () => {
    if (!isActive) {
      await switchTo(server.id)
    }
  }

  const handleEdit = () => {
    showEditServerModal(server.id)
  }

  const handleDelete = async () => {
    Prompt.prompt({
      title: t('servers.delete.title'),
      description: t('servers.delete.description', { serverName: server.name }),
      variant: 'danger',
      onConfirmText: t('servers.delete.confirm'),
      onCancelText: t('common.cancel'),
      onConfirm: async () => {
        multiServerStoreSetters.removeServer(server.id)
        saveMultiServerConfig({
          servers: Object.values(useMultiServerStore.getState().servers),
          activeServerId: useMultiServerStore.getState().activeServerId,
        })
      },
    })
  }

  const getStatusColor = () => {
    switch (health?.status) {
      case 'healthy': {
        return 'bg-green'
      }
      case 'warning': {
        return 'bg-orange'
      }
      case 'unhealthy': {
        return 'bg-red'
      }
      default: {
        return 'bg-text-quaternary'
      }
    }
  }

  const getStatusTitle = () => {
    if (!health) return t('servers.status.unknown')
    return `${health.status} · ${health.responseTime}ms${health.version ? ` · v${health.version}` : ''}`
  }

  return (
    <div
      className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-fill/30 transition-colors"
      onClick={handleActivate}
    >
      <div className="flex flex-col flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${getStatusColor()}`}
            title={getStatusTitle()}
          />
          <span className="text-sm font-medium text-text">{server.name}</span>
          {isActive && (
            <span className="text-xs px-2 py-1 bg-accent/20 text-accent rounded-full">
              {t('servers.status.active')}
            </span>
          )}
        </div>
        <span className="text-xs text-text-secondary mt-1">
          <span>
            {server.config.baseUrl ||
              `${server.config.useHttps ? 'https' : 'http'}://${server.config.host}:${server.config.port}`}
          </span>
          <span> · {server.config.username}</span>
          {remembered && <span> · {t('servers.status.passwordSaved')}</span>}
        </span>
      </div>

      <div className="flex items-center gap-2 ml-4">
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation()
            handleEdit()
          }}
        >
          {t('common.edit')}
        </Button>
        {!isActive && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              handleDelete()
            }}
          >
            {t('common.delete')}
          </Button>
        )}
      </div>
    </div>
  )
})
