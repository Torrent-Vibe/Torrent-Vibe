import type { InputHTMLAttributes, ReactNode } from 'react'

import { Input } from '~/components/ui/input'

import { SettingField } from './SettingField'

interface SettingInputFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'size'
> {
  dense?: boolean
  description?: ReactNode
  label: ReactNode
  onChange: (value: string) => void
  value: string | number
}

export const SettingInputField = ({
  id,
  label,
  description,
  value,
  onChange,
  dense = false,
  ...rest
}: SettingInputFieldProps) => {
  return (
    <SettingField
      dense={dense}
      description={description}
      htmlFor={id}
      label={label}
    >
      <Input
        className={dense ? 'h-8 text-[13px]' : undefined}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </SettingField>
  )
}
