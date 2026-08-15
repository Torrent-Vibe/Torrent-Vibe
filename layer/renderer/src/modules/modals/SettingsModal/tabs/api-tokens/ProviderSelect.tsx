import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

import { SettingField } from '../components/SettingField'

interface ProviderOption<T extends string> {
  id: T
  label: string
}

interface ProviderSelectProps<T extends string> {
  label: string
  description?: string
  placeholder?: string
  options: ProviderOption<T>[]
  value: T | null
  onChange: (id: T) => void
  disabled?: boolean
  loading?: boolean
}

export const ProviderSelect = <T extends string>({
  label,
  description,
  placeholder,
  options,
  value,
  onChange,
  disabled,
  loading,
}: ProviderSelectProps<T>) => {
  if (options.length === 0) {
    return null
  }

  const selectValue = value ?? options[0]!.id

  return (
    <SettingField label={label} description={description}>
      <Select
        value={selectValue}
        onValueChange={next => onChange(next as T)}
        disabled={disabled || loading}
      >
        <SelectTrigger loading={loading}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingField>
  )
}
