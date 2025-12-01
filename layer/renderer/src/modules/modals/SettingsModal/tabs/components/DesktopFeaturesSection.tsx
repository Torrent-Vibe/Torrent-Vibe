import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { ipcServices } from '~/lib/ipc-client'

import { SettingField, SettingSectionCard } from '.'

export const DesktopFeaturesSection = () => {
  const { t } = useTranslation()

  return (
    <SettingSectionCard title={t('desktop.features.title')}>
      <SettingField
        label={t('desktop.fileAssociation.label')}
        description={t('desktop.fileAssociation.description')}
        controlAlign="end"
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              const res = await ipcServices?.fileAssociation.repair()
              if (res?.ok) {
                toast.success(
                  t('desktop.fileAssociation.success') +
                    (res.message ? `: ${res.message}` : ''),
                )
              } else {
                toast.error(
                  `${t(
                    'desktop.fileAssociation.failed',
                  )}: ${res?.message || t('desktop.fileAssociation.unknownError')}`,
                )
              }
            } catch (e: unknown) {
              const error = e as Error
              toast.error(
                `${t('desktop.fileAssociation.failed')}: ${String(
                  error?.message || e,
                )}`,
              )
            }
          }}
        >
          {t('desktop.fileAssociation.repair')}
        </Button>
      </SettingField>
    </SettingSectionCard>
  )
}
