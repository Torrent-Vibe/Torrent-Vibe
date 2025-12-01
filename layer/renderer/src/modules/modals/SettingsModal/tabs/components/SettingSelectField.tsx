import type { ReactNode } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

import { SettingField } from './SettingField'

interface OptionItem {
  value: string
  label: ReactNode
}

interface SettingSelectFieldProps {
  id?: string
  label: ReactNode
  description?: ReactNode
  value: string
  onValueChange: (value: string) => void
  options?: OptionItem[]
  renderItems?: () => ReactNode
}

export const SettingSelectField = ({
  id,
  label,
  description,
  value,
  onValueChange,
  options,
  renderItems,
}: SettingSelectFieldProps) => {
  return (
    <SettingField label={label} description={description} htmlFor={id}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {renderItems
            ? renderItems()
            : options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
        </SelectContent>
      </Select>
    </SettingField>
  )
}
