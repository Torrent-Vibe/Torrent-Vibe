import { useTranslation } from 'react-i18next'

import { HelperPairingPanel } from '~/modules/helper-client/HelperPairingPanel'
import { useServerHelperTargets } from '~/modules/helper-client/hooks'

import { SettingSectionCard } from '../../modals/SettingsModal/tabs/components'
import { HelperLogSection } from './HelperLogSection'

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
            <div className="space-y-2" key={target.id}>
              <HelperPairingPanel
                host={target.host}
                name={target.name}
                serverId={target.id}
              />
              <HelperLogSection serverId={target.id} />
            </div>
          ))}
        </div>
      )}
    </SettingSectionCard>
  )
}
