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
  description?: string
  disabled?: boolean
  label: string
  loading?: boolean
  onChange: (id: T) => void
  options: ProviderOption<T>[]
  placeholder?: string
  value: T | null
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
    <SettingField description={description} label={label}>
      <Select
        disabled={disabled || loading}
        value={selectValue}
        onValueChange={(next) => onChange(next as T)}
      >
        <SelectTrigger loading={loading}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingField>
  )
}
