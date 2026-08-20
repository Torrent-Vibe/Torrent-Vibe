import { useTranslation } from 'react-i18next'

import { DialogHeader, DialogTitle } from '~/components/ui/dialog'
import type { ModalComponent } from '~/components/ui/modal/types'
import { useHelperBindingsStore } from '~/modules/helper-client/bindings'
import { HelperLogPanel } from '~/modules/helper-client/HelperLogPanel'
import { capabilitiesForServer } from '~/modules/subscriptions/capability-cache'
import { useSubscriptionsStore } from '~/modules/subscriptions/store'

export const HelperLogDrawer: ModalComponent<{
  replicaId: string
  serverId: string
}> = ({ serverId, replicaId }) => {
  const { t } = useTranslation('app')
  const binding = useHelperBindingsStore((state) => state.bindings[serverId])
  const capabilities = useSubscriptionsStore((state) =>
    capabilitiesForServer(serverId, state),
  )

  return (
    <div className="flex h-[70vh] max-h-[640px] w-full flex-col">
      <DialogHeader>
        <DialogTitle>{t('helper.logs.title')}</DialogTitle>
      </DialogHeader>
      <div className="mt-3 min-h-0 flex-1">
        {binding ? (
          <HelperLogPanel
            baseUrl={binding.url}
            capabilities={capabilities}
            replicaId={replicaId}
            token={binding.token}
          />
        ) : (
          <p className="text-sm text-text-secondary">
            {t('helper.logs.tooOld')}
          </p>
        )}
      </div>
    </div>
  )
}

HelperLogDrawer.contentClassName = 'w-[720px] max-w-[95vw]'
