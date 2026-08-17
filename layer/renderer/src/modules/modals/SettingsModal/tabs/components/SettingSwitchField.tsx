import type { ReactNode } from 'react'

import { Switch } from '~/components/ui/switch'

import { SettingField } from './SettingField'

interface SettingSwitchFieldProps {
  checked: boolean
  description?: ReactNode
  disabled?: boolean
  id?: string
  label: ReactNode
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
    <SettingField description={description} htmlFor={id} label={label}>
      <Switch
        checked={checked}
        disabled={disabled}
        id={id}
        key={id}
        onCheckedChange={(v) => onCheckedChange(Boolean(v))}
      />
    </SettingField>
  )
}
