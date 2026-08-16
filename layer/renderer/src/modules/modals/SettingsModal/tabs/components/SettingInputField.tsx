import type { InputHTMLAttributes, ReactNode } from 'react'

import { Input } from '~/components/ui/input'

import { SettingField } from './SettingField'

interface SettingInputFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'size'
> {
  label: ReactNode
  description?: ReactNode
  value: string | number
  onChange: (value: string) => void
  dense?: boolean
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
      label={label}
      description={description}
      htmlFor={id}
      dense={dense}
    >
      <Input
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={dense ? 'h-8 text-[13px]' : undefined}
        {...rest}
      />
    </SettingField>
  )
}
