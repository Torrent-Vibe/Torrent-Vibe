import type { AiProviderId } from '@torrent-vibe/shared'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

import { SettingField } from '../components/SettingField'

interface ProviderOption {
  id: AiProviderId
  label: string
}

interface AiProviderPreferenceSelectorProps {
  disabled?: boolean
  loading?: boolean
  onChange: (providerId: AiProviderId) => void
  providers: ProviderOption[]
  value: AiProviderId | null
}

export const AiProviderPreferenceSelector = ({
  providers,
  value,
  onChange,
  disabled,
  loading,
}: AiProviderPreferenceSelectorProps) => {
  const { t } = useTranslation('setting')

  if (providers.length < 2) {
    return null
  }

  const selectValue = value ?? providers[0]?.id ?? providers[0]!.id

  return (
    <SettingField
      description={t('tabs.apiTokens.providers.preference.description')}
      label={t('tabs.apiTokens.providers.preference.label')}
    >
      <div className="flex w-full flex-col gap-2">
        <Select
          disabled={disabled || loading}
          value={selectValue}
          onValueChange={(next) => onChange(next as AiProviderId)}
        >
          <SelectTrigger loading={loading}>
            <SelectValue
              placeholder={t('tabs.apiTokens.providers.preference.placeholder')}
            />
          </SelectTrigger>
          <SelectContent>
            {providers.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>
                {provider.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </SettingField>
  )
}
