import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { SettingSectionCard } from '~/modules/modals/SettingsModal/tabs/components'

import { useMultiServerStore } from '../stores/multi-server-store'
import { showAddServerModal } from '../utils/modal-helpers'
import { ServerItem } from './ServerListItem'

export const ServerManagementSection = () => {
  const { t } = useTranslation()
  const { order, servers, activeServerId } = useMultiServerStore((s) => ({
    order: s.order,
    servers: s.servers,
    activeServerId: s.activeServerId,
  }))

  const handleAddServer = () => {
    showAddServerModal()
  }

  return (
    <SettingSectionCard
      title={t('servers.management')}
      description={t('servers.clickToActivate')}
      headerAction={
        <Button size="sm" onClick={handleAddServer}>
          <i className="i-mingcute-add-line w-4 h-4 mr-1" />
          {t('servers.addServer')}
        </Button>
      }
    >
      {order.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-text-secondary mb-4">
            <i className="i-mingcute-server-line w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">{t('servers.noServersConfigured')}</p>
          </div>
          <Button onClick={handleAddServer}>
            {t('servers.addFirstServer')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {order.map((id) => {
            const server = servers[id]
            if (!server) return null

            return (
              <ServerItem
                key={id}
                server={server}
                isActive={activeServerId === id}
              />
            )
          })}
        </div>
      )}
    </SettingSectionCard>
  )
}
