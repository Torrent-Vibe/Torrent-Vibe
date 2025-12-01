import type { ReactNode } from 'react'

import { Switch } from '~/components/ui/switch'

import { SettingField } from './SettingField'

interface SettingSwitchFieldProps {
  id?: string
  label: ReactNode
  description?: ReactNode
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}

export const SettingSwitchField = ({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: SettingSwitchFieldProps) => {
  return (
    <SettingField label={label} description={description} htmlFor={id}>
      <Switch
        key={id}
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange(Boolean(v))}
      />
    </SettingField>
  )
}
