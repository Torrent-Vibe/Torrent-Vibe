import type { InputHTMLAttributes, ReactNode } from 'react'

import { Input } from '~/components/ui/input'

import { SettingField } from './SettingField'

interface SettingInputFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  label: ReactNode
  description?: ReactNode
  value: string | number
  onChange: (value: string) => void
}

export const SettingInputField = ({
  id,
  label,
  description,
  value,
  onChange,
  ...rest
}: SettingInputFieldProps) => {
  return (
    <SettingField label={label} description={description} htmlFor={id}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </SettingField>
  )
}
