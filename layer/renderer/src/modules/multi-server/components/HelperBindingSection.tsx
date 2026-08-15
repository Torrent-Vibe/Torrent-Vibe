import { useTranslation } from 'react-i18next'

import { HelperPairingPanel } from '~/modules/helper-client/HelperPairingPanel'
import { useServerHelperTargets } from '~/modules/helper-client/hooks'

import { SettingSectionCard } from '../../modals/SettingsModal/tabs/components'

export const HelperBindingSection = () => {
  const { t } = useTranslation('app')
  const targets = useServerHelperTargets()

  return (
    <SettingSectionCard
      title={t('servers.helper.title')}
      description={t('servers.helper.description')}
    >
      {targets.length === 0
        ? (
            <p className="text-sm text-text-secondary">
              {t('servers.noServersConfigured')}
            </p>
          )
        : (
            <div className="space-y-3">
              {targets.map(target => (
                <HelperPairingPanel
                  key={target.id}
                  serverId={target.id}
                  host={target.host}
                  name={target.name}
                />
              ))}
            </div>
          )}
    </SettingSectionCard>
  )
}
