import { useTranslation } from 'react-i18next'

import { WebConnectionSection } from './components'

export const AppConnectionTab = () => {
  const { t } = useTranslation('setting')

  if (ELECTRON) {
    return (
      <div className="text-sm text-text-secondary">
        {t('appConnection.webOnlyMessage')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <WebConnectionSection />
    </div>
  )
}
