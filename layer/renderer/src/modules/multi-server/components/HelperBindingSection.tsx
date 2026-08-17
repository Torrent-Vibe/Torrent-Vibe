import { useTranslation } from 'react-i18next'

import { HelperPairingPanel } from '~/modules/helper-client/HelperPairingPanel'
import { useServerHelperTargets } from '~/modules/helper-client/hooks'

import { SettingSectionCard } from '../../modals/SettingsModal/tabs/components'

export const HelperBindingSection = () => {
  const { t } = useTranslation('app')
  const targets = useServerHelperTargets()

  return (
    <SettingSectionCard
      description={t('servers.helper.description')}
      title={t('servers.helper.title')}
    >
      {targets.length === 0 ? (
        <p className="text-sm text-text-secondary">
          {t('servers.noServersConfigured')}
        </p>
      ) : (
        <div className="space-y-3">
          {targets.map((target) => (
            <HelperPairingPanel
              host={target.host}
              key={target.id}
              name={target.name}
              serverId={target.id}
            />
          ))}
        </div>
      )}
    </SettingSectionCard>
  )
}
