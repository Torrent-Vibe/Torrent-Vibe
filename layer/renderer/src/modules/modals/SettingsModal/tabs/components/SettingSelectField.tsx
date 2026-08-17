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
  label: ReactNode
  value: string
}

interface SettingSelectFieldProps {
  description?: ReactNode
  id?: string
  label: ReactNode
  onValueChange: (value: string) => void
  options?: OptionItem[]
  renderItems?: () => ReactNode
  value: string
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
    <SettingField description={description} htmlFor={id} label={label}>
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
