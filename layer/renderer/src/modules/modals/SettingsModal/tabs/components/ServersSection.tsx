import { useTranslation } from 'react-i18next'

export const ServersSection = () => {
  const { t } = useTranslation('setting')
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-text mb-1">
        {t('general.servers.title')}
      </h2>
      <p className="text-sm text-text-secondary">
        {t('general.servers.description')}
      </p>
    </section>
  )
}
