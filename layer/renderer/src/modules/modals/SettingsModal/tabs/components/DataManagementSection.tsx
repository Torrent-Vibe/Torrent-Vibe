import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { Modal } from '~/components/ui/modal/ModalManager'
import {
  AppSettingsExportModal,
  AppSettingsImportModal,
} from '~/modules/settings-data-management'

import { SettingSectionCard } from './SettingSectionCard'

export const DataManagementSection = () => {
  const { t } = useTranslation('setting')

  const handleImport = () => {
    Modal.present(AppSettingsImportModal)
  }

  const handleExport = () => {
    Modal.present(AppSettingsExportModal)
  }

  return (
    <SettingSectionCard
      title={t('general.dataManagement.title')}
      description={t('general.dataManagement.description')}
      headerAction={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={handleImport}>
            {t('general.dataManagement.actions.import')}
          </Button>
          <Button size="sm" variant="secondary" onClick={handleExport}>
            {t('general.dataManagement.actions.export')}
          </Button>
        </div>
      }
    >
      <p className="text-xs text-text-secondary">
        {t('general.dataManagement.notice')}
      </p>
    </SettingSectionCard>
  )
}
