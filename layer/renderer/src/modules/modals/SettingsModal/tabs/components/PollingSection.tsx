import { useTranslation } from 'react-i18next'

import type { PollingInterval } from '~/atoms/settings/general'
import {
  POLLING_INTERVAL_OPTIONS,
  setPollingInterval,
  usePollingInterval,
} from '~/atoms/settings/general'
import { SelectItem } from '~/components/ui/select'

import { SettingSectionCard, SettingSelectField } from '.'

export const PollingSection = () => {
  const { t } = useTranslation('setting')
  const currentInterval = usePollingInterval()

  return (
    <SettingSectionCard
      title={t('general.polling.title')}
      description={t('general.polling.description')}
    >
      <SettingSelectField
        label={t('general.polling.interval.label')}
        value={currentInterval.toString()}
        onValueChange={(value) =>
          setPollingInterval(Number(value) as PollingInterval)
        }
        renderItems={() =>
          POLLING_INTERVAL_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value.toString()}>
              {t(option.labelKey)}
            </SelectItem>
          ))
        }
      />
    </SettingSectionCard>
  )
}
