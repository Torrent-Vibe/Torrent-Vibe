import type { ReactNode, TextareaHTMLAttributes } from 'react'

import { Textarea } from '~/components/ui/input/Textarea'

import { SettingField } from './SettingField'

interface SettingTextareaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onChange' | 'value'
> {
  description?: ReactNode
  id?: string
  label: ReactNode
  onChange: (value: string) => void
  rows?: number
  value: string
}

export const SettingTextareaField = ({
  id,
  label,
  description,
  value,
  onChange,
  rows = 4,
  ...rest
}: SettingTextareaFieldProps) => {
  return (
    <SettingField description={description} htmlFor={id} label={label}>
      <Textarea
        className="text-xs"
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </SettingField>
  )
}
