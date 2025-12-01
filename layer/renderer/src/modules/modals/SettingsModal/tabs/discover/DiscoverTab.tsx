import { useTranslation } from 'react-i18next'

import { MTeamProviderSection } from './providers'

export const DiscoverTab = () => {
  const { t } = useTranslation('setting')

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary leading-relaxed">
        {t('discover.description')}
      </p>

      <MTeamProviderSection />
    </div>
  )
}
